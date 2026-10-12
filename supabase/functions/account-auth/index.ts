// Edge Function `account-auth`: the server side of "register", "forgot password" and the OTP checks.
//
// WHY it exists: Supabase's phone provider cannot be used (it needs Twilio-style credentials and does not support MSG91).
// Logins are therefore a hidden email-style identity "<10 digits>@users.crewconnect.invalid" + password. Proving that someone
// owns a mobile number is done with OUR OTP system in the database (supabase/migrations/20261011140000_own_otp_accounts.sql);
// this function is the only caller of those database functions and of the Auth Admin API.
//
// Called by the browser (web/src/features/auth/services/supabaseAuthService.ts) BEFORE login, so it is deployed with
// verify_jwt = false. That means this code must protect itself: every input is validated, OTP issue/check enforce cooldowns,
// per-number and project-wide hourly caps and a per-code attempt limit INSIDE the database, and the OTP is never returned
// to the browser (test numbers get the fixed dev code only because the database says so).
//
// Docs (official, checked 2026-10-11): Edge Functions secrets and auth, CORS, Auth Admin API createUser / updateUserById.
//   https://supabase.com/docs/guides/functions/secrets · https://supabase.com/docs/guides/functions/auth
//   https://supabase.com/docs/guides/functions/cors · https://supabase.com/docs/reference/javascript/auth-admin-createuser

import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { corsHeaders } from 'npm:@supabase/supabase-js@2.117.3/cors'
import { sendSms, smsConfigured } from './sms.ts'
import { verifyTurnstile } from './turnstile.ts'

type Purpose = 'register' | 'reset'
type Code =
  | 'INVALID_INPUT' | 'ALREADY_REGISTERED' | 'NOT_REGISTERED' | 'RATE_LIMITED' | 'SMS_FAILED'
  | 'INVALID_OTP' | 'OTP_EXPIRED' | 'TOO_MANY_ATTEMPTS' | 'WEAK_PASSWORD' | 'SAME_PASSWORD' | 'CAPTCHA_FAILED' | 'UNKNOWN'

const PHONE = /^[6-9]\d{9}$/
const OTP = /^\d{6}$/
const toEmail = (phone: string) => `${phone}@users.crewconnect.invalid` // the same rule lives in the web app: keep both in step

const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const ok = () => reply({ ok: true })
const fail = (code: Code) => reply({ ok: false, code })

// Same rule as validateNewPassword() in the web app. The upper limit counts BYTES (not characters): the bcrypt hashing Supabase
// uses reads at most 72 bytes, and non-English letters or emoji take 2-4 bytes each.
const byteLength = (text: string) => new TextEncoder().encode(text).length
function passwordProblem(password: string, phone: string): string | null {
  if (password.length < 8 || byteLength(password) > 72) return 'length'
  if (/\s/.test(password)) return 'spaces'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'letters+numbers'
  if (password.includes(phone)) return 'contains phone'
  return null
}

// The database raises short codes as the error message; anything else is UNKNOWN.
const KNOWN: Code[] = ['INVALID_INPUT', 'ALREADY_REGISTERED', 'NOT_REGISTERED', 'RATE_LIMITED']
const fromDb = (message: string): Code => KNOWN.find((c) => c === message) ?? 'UNKNOWN'
const fromOtpStatus = (status: unknown): Code => {
  if (status === 'INVALID_OTP' || status === 'OTP_EXPIRED') return status
  if (status === 'LOCKED') return 'TOO_MANY_ATTEMPTS'
  return 'UNKNOWN'
}

// Best-effort caller IP. UNVERIFIED which header Supabase's edge guarantees; the per-IP limit is one layer among several
// (CAPTCHA, per-number limits, project-wide cap) and a missing IP is simply not limited.
const clientIp = (req: Request) =>
  req.headers.get('cf-connecting-ip')?.trim() || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL')
  // New secret keys first; the legacy service_role key as the documented fallback.
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
  const key = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Edge Function secrets are missing')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return reply({ ok: false, code: 'INVALID_INPUT' }, 405)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('INVALID_INPUT')
  }

  const phone = typeof body.phone === 'string' ? body.phone : ''
  if (!PHONE.test(phone)) return fail('INVALID_INPUT')

  try {
    const db = adminClient()

    /* ---------- send-otp: { phone, purpose, captcha } ---------- */
    if (body.action === 'send-otp') {
      const purpose = body.purpose
      if (purpose !== 'register' && purpose !== 'reset') return fail('INVALID_INPUT')

      const isTest = await db.rpc('auth_is_test_phone', { p_phone: phone })
      if (isTest.error) return fail('UNKNOWN')
      // No SMS gateway yet: refuse real numbers BEFORE a code is issued, so they do not burn their rate limit for nothing.
      if (!isTest.data && !smsConfigured()) return fail('SMS_FAILED')

      // CAPTCHA (Cloudflare Turnstile): protects the SMS bill and stops people locking others out of registering.
      // Secret = Supabase dashboard -> Edge Functions -> Secrets -> TURNSTILE_SECRET_KEY (never in the repo).
      //  * secret set      -> EVERY OTP request needs a valid token (checked BEFORE any database work)
      //  * secret not set  -> only the dev test numbers work, and a REAL SMS is never sent (the line below)
      const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY')
      if (!turnstileSecret && !isTest.data) return fail('SMS_FAILED')
      if (turnstileSecret) {
        const human = await verifyTurnstile(turnstileSecret, body.captcha, clientIp(req))
        if (!human.ok) return fail('CAPTCHA_FAILED')
      }

      // Per-IP limit (hashed in the database): stops one caller probing many numbers or draining the SMS budget.
      const allowed = await db.rpc('auth_ip_allow', { p_ip: clientIp(req) })
      if (allowed.error) return fail('UNKNOWN')
      if (!allowed.data) return fail('RATE_LIMITED')

      const issued = await db.rpc('auth_otp_issue', { p_phone: phone, p_purpose: purpose as Purpose })
      if (issued.error) return fail(fromDb(issued.error.message))
      const row = issued.data?.[0]
      if (!row) return fail('UNKNOWN')

      if (!row.is_test) {
        try {
          await sendSms(phone, `${row.code} is your Crew Connect OTP. It is valid for 5 minutes. Do not share it.`)
        } catch {
          return fail('SMS_FAILED')
        }
      }
      return ok()
    }

    /* ---------- check-otp: { phone, purpose, otp } (does not use the code up) ---------- */
    if (body.action === 'check-otp') {
      const { purpose, otp } = body
      if ((purpose !== 'register' && purpose !== 'reset') || typeof otp !== 'string' || !OTP.test(otp)) return fail('INVALID_INPUT')
      const check = await db.rpc('auth_otp_check', { p_phone: phone, p_purpose: purpose as Purpose, p_code: otp, p_consume: false })
      if (check.error) return fail('UNKNOWN')
      return check.data === 'OK' ? ok() : fail(fromOtpStatus(check.data))
    }

    /* ---------- register: { phone, otp, password, role } ---------- */
    if (body.action === 'register') {
      const { otp, password, role } = body
      if (typeof otp !== 'string' || !OTP.test(otp) || typeof password !== 'string' || (role !== 'candidate' && role !== 'employer')) {
        return fail('INVALID_INPUT')
      }
      if (passwordProblem(password, phone)) return fail('WEAK_PASSWORD')

      const check = await db.rpc('auth_otp_check', { p_phone: phone, p_purpose: 'register', p_code: otp, p_consume: false })
      if (check.error) return fail('UNKNOWN')
      if (check.data !== 'OK') return fail(fromOtpStatus(check.data))

      let userId: string
      let createdNow = false
      const created = await db.auth.admin.createUser({ email: toEmail(phone), password, email_confirm: true })
      if (created.error || !created.data.user) {
        const code = created.error?.code
        if (code === 'weak_password') return fail('WEAK_PASSWORD')
        if (code !== 'email_exists' && code !== 'user_already_exists') {
          console.error('createUser failed:', code, created.error?.message)
          return fail('UNKNOWN')
        }
        // The login already exists. If it has an account, the number is taken. If it has NONE (an earlier registration
        // failed half-way), finish that account now instead of locking the person out for good.
        const orphan = await db.rpc('auth_find_orphan_login', { p_phone: phone })
        if (orphan.error) return fail('UNKNOWN')
        if (!orphan.data) return fail('ALREADY_REGISTERED')
        const fixed = await db.auth.admin.updateUserById(orphan.data, { password, email_confirm: true })
        if (fixed.error) {
          if (fixed.error.code === 'weak_password') return fail('WEAK_PASSWORD')
          console.error('finishing a half-made account failed:', fixed.error.code, fixed.error.message)
          return fail('UNKNOWN')
        }
        userId = orphan.data
      } else {
        userId = created.data.user.id
        createdNow = true
      }

      const account = await db.rpc('auth_create_account', { p_user_id: userId, p_phone: phone, p_role: role })
      if (account.error) {
        if (createdNow) {
          // do not leave a login without an account behind; if this cleanup itself fails, the recovery above finishes it next time
          const removed = await db.auth.admin.deleteUser(userId)
          if (removed.error) console.error('cleanup of a failed registration failed:', removed.error.message)
        }
        return fail(fromDb(account.error.message))
      }
      const used = await db.rpc('auth_otp_check', { p_phone: phone, p_purpose: 'register', p_code: otp, p_consume: true })
      if (used.error || used.data !== 'OK') console.error('OTP could not be marked as used (register):', used.error?.message ?? used.data)
      return ok() // the browser now logs in with the password
    }

    /* ---------- reset-password: { phone, otp, password } ---------- */
    if (body.action === 'reset-password') {
      const { otp, password } = body
      if (typeof otp !== 'string' || !OTP.test(otp) || typeof password !== 'string') return fail('INVALID_INPUT')
      if (passwordProblem(password, phone)) return fail('WEAK_PASSWORD')

      const check = await db.rpc('auth_otp_check', { p_phone: phone, p_purpose: 'reset', p_code: otp, p_consume: false })
      if (check.error) return fail('UNKNOWN')
      if (check.data !== 'OK') return fail(fromOtpStatus(check.data))

      const found = await db.rpc('auth_find_user', { p_phone: phone })
      if (found.error) return fail('UNKNOWN')
      if (!found.data) return fail('NOT_REGISTERED')

      const updated = await db.auth.admin.updateUserById(found.data, { password })
      if (updated.error) {
        if (updated.error.code === 'weak_password') return fail('WEAK_PASSWORD')
        if (updated.error.code === 'same_password') return fail('SAME_PASSWORD')
        console.error('updateUserById failed:', updated.error.code, updated.error.message)
        return fail('UNKNOWN')
      }
      // The password changed: end every old session of this person (a stolen old login must stop working).
      // An access token that was already issued stays valid until it expires (default 1 hour); refresh tokens die with the session.
      const revoked = await db.rpc('auth_revoke_sessions', { p_user_id: found.data })
      if (revoked.error) console.error('could not end old sessions after a password reset:', revoked.error.message)
      const used = await db.rpc('auth_otp_check', { p_phone: phone, p_purpose: 'reset', p_code: otp, p_consume: true })
      if (used.error || used.data !== 'OK') console.error('OTP could not be marked as used (reset):', used.error?.message ?? used.data)
      return ok()
    }

    return fail('INVALID_INPUT')
  } catch (err) {
    console.error('account-auth crashed:', err instanceof Error ? err.message : 'unknown error') // never log phone numbers, codes or passwords
    return reply({ ok: false, code: 'UNKNOWN' }, 500)
  }
})

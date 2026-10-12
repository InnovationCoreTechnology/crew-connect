import { isAuthApiError } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import type { Role, User } from '../types'
import { AuthError, type AuthErrorCode, type AuthService } from './types'

// REAL auth backend. We do NOT use Supabase's phone provider (it needs Twilio-style credentials and does not support MSG91).
//   * A person's login in Supabase Auth is a hidden email-style identity "<10 digits>@users.crewconnect.invalid" + password.
//     Log in = signInWithPassword (VERIFIED 2026-10-11: works with no phone provider).
//   * Register / forgot password = our OTP, kept in the database and driven by the Edge Function `account-auth`
//     (supabase/functions/account-auth, supabase/migrations/20261011140000_own_otp_accounts.sql).
//   * The role and the real mobile number live in the `profiles` table (read with Row Level Security).
// Docs: https://supabase.com/docs/guides/auth/passwords · https://supabase.com/docs/reference/javascript/functions-invoke
//       error codes: https://supabase.com/docs/guides/auth/debugging/error-codes

// The same rule is written in the Edge Function. If you change it, change both AND migrate existing logins.
const toEmail = (phone: string) => `${phone}@users.crewconnect.invalid`

const MESSAGES: Record<string, { code: AuthErrorCode; text: string }> = {
  ALREADY_REGISTERED: { code: 'ALREADY_REGISTERED', text: 'This number is already registered.' },
  NOT_REGISTERED: { code: 'NOT_REGISTERED', text: 'This number is not registered.' },
  RATE_LIMITED: { code: 'RATE_LIMITED', text: 'Too many OTP requests. Please wait a minute and try again.' },
  SMS_FAILED: { code: 'SMS_FAILED', text: 'We could not send the SMS right now. Please try again later.' },
  INVALID_OTP: { code: 'INVALID_OTP', text: 'Wrong OTP.' },
  OTP_EXPIRED: { code: 'OTP_EXPIRED', text: 'This OTP has expired. Please request a new one.' },
  TOO_MANY_ATTEMPTS: { code: 'TOO_MANY_ATTEMPTS', text: 'Too many wrong attempts. Please request a new OTP.' },
  WEAK_PASSWORD: { code: 'WEAK_PASSWORD', text: 'This password is too weak. Use at least 8 characters with letters and numbers.' },
  SAME_PASSWORD: { code: 'SAME_PASSWORD', text: 'Please choose a different password from your old one.' },
}
const UNKNOWN = new AuthError('UNKNOWN', 'Something went wrong. Please try again.')

interface AccountReply { ok: boolean; code?: string }

// Calls the Edge Function. It answers HTTP 200 with { ok: false, code } for expected problems (see index.ts there).
async function callAccount(body: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase.functions.invoke<AccountReply>('account-auth', { body })
  if (error || !data) throw UNKNOWN
  if (data.ok) return
  const known = data.code ? MESSAGES[data.code] : undefined
  throw known ? new AuthError(known.code, known.text) : UNKNOWN
}

async function loadUser(): Promise<User | null> {
  // getSession() reads the stored session (fast, no network). It only tells us WHO is logged in;
  // the role and the number come from the database, which validates the token itself (Row Level Security).
  const { data } = await supabase.auth.getSession()
  const authUser = data.session?.user
  if (!authUser) return null

  const { data: profile, error } = await supabase.from('profiles').select('role,phone').eq('id', authUser.id).maybeSingle()
  if (error || !profile) return null // no account for this login, or the token was rejected
  return { id: authUser.id, phone: profile.phone, role: profile.role as Role }
}

async function signIn(phone: string, password: string): Promise<User | null> {
  const { error } = await supabase.auth.signInWithPassword({ email: toEmail(phone), password })
  if (error) {
    // Wrong number OR wrong password: one message for both on purpose.
    if (isAuthApiError(error) && error.code === 'invalid_credentials') {
      throw new AuthError('WRONG_PASSWORD', 'Wrong mobile number or password.')
    }
    if (isAuthApiError(error) && (error.code === 'over_request_rate_limit' || error.status === 429)) {
      throw new AuthError('RATE_LIMITED', 'Too many attempts. Please wait a minute and try again.')
    }
    throw new AuthError('UNKNOWN', 'Could not log in. Please try again.')
  }
  return loadUser()
}

export const supabaseAuthService: AuthService = {
  sendOtp: (phone, purpose) => callAccount({ action: 'send-otp', phone, purpose }),

  checkOtp: (phone, purpose, otp) => callAccount({ action: 'check-otp', phone, purpose, otp }),

  async register(phone, otp, password, role) {
    await callAccount({ action: 'register', phone, otp, password, role })
    const user = await signIn(phone, password)
    if (!user) throw UNKNOWN
    return user
  },

  async resetPassword(phone, otp, password) {
    await callAccount({ action: 'reset-password', phone, otp, password })
    const user = await signIn(phone, password)
    if (!user) throw UNKNOWN
    return user
  },

  signInWithPassword: signIn,

  getSession: loadUser,

  async logout() {
    await supabase.auth.signOut()
  },

  onSignedOut(callback) {
    // Do not call other Supabase methods inside this callback (documented deadlock risk); we only set state.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') callback()
    })
    return () => data.subscription.unsubscribe()
  },
}

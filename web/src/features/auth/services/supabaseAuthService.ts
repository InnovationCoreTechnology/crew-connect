import { isAuthApiError } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import { AUTH_CONFIG } from '../config'
import type { Role, User } from '../types'
import { AuthError, type AuthService } from './types'

// REAL auth backend: Supabase Auth phone OTP.
// Flow: signInWithOtp (SMS) -> verifyOtp (session) -> register_account() (role, server-side, see supabase/migrations).
// Docs: https://supabase.com/docs/guides/auth/phone-login
// Error codes: https://supabase.com/docs/guides/auth/debugging/error-codes

const toE164 = (phone: string) => `${AUTH_CONFIG.countryCode}${phone}`
const toNational = (authPhone: string) => authPhone.slice(-AUTH_CONFIG.phoneLength) // Auth returns 919845000001 (with or without +)

// Turns a Supabase error into one of our friendly codes. Unknown cases stay UNKNOWN.
function toAuthError(err: unknown, fallback: string): AuthError {
  if (isAuthApiError(err)) {
    switch (err.code) {
      case 'over_sms_send_rate_limit':
      case 'over_request_rate_limit':
        return new AuthError('RATE_LIMITED', 'Too many attempts. Please wait a minute and try again.')
      case 'otp_expired':
        return new AuthError('OTP_EXPIRED', 'This OTP has expired. Please request a new one.')
      case 'sms_send_failed':
        return new AuthError('SMS_FAILED', 'We could not send the SMS. Please try again.')
      // Phone sign-in is switched off / no SMS provider is set up on the Supabase project (an owner setup issue, not the user's).
      case 'phone_provider_disabled':
        return new AuthError('SMS_FAILED', 'Phone login is not available right now. Please try again later.')
      // shouldCreateUser:false for an unknown number. VERIFIED 2026-10-11 against the live project: it answers
      // `otp_disabled` (HTTP 422, "Signups not allowed for otp"). `signup_disabled` is kept as a safe alias (unverified).
      case 'signup_disabled':
      case 'otp_disabled':
        return new AuthError('NOT_REGISTERED', 'This number is not registered.')
    }
  }
  return new AuthError('UNKNOWN', fallback)
}

async function loadUser(): Promise<User | null> {
  // getSession() reads the stored session (fast, no network). It is only used to learn the id/phone;
  // the ROLE comes from the database, which validates the token itself (Row Level Security).
  const { data } = await supabase.auth.getSession()
  const authUser = data.session?.user
  if (!authUser?.phone) return null

  const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', authUser.id).maybeSingle()
  if (error || !profile) return null // not registered yet, or the token was rejected
  return { id: authUser.id, phone: toNational(authUser.phone), role: profile.role as Role }
}

export const supabaseAuthService: AuthService = {
  async sendOtp(phone, mode) {
    const { error } = await supabase.auth.signInWithOtp({
      phone: toE164(phone),
      options: { shouldCreateUser: mode === 'register' },
    })
    if (error) throw toAuthError(error, 'Could not send the OTP.')
  },

  async verifyOtp(phone, otp) {
    const { error } = await supabase.auth.verifyOtp({ phone: toE164(phone), token: otp, type: 'sms' })
    if (error) {
      const mapped = toAuthError(error, 'Could not verify the OTP.')
      // Anything the server rejects here that is not "expired"/"rate limited" means the code was wrong.
      throw mapped.code === 'UNKNOWN' ? new AuthError('INVALID_OTP', 'Wrong OTP.') : mapped
    }
  },

  async register(role) {
    const { error } = await supabase.rpc('register_account', { p_role: role })
    // ALREADY_REGISTERED is fine here: the person proved they own the number, so just log them in.
    if (error && error.message !== 'ALREADY_REGISTERED') throw new AuthError('UNKNOWN', 'Could not create your account.')
    const user = await loadUser()
    if (!user) throw new AuthError('UNKNOWN', 'Could not load your account.')
    return user
  },

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

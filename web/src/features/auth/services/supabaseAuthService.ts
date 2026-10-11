import { isAuthApiError } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import { AUTH_CONFIG } from '../config'
import type { Role, User } from '../types'
import { AuthError, type AuthService } from './types'

// REAL auth backend: Supabase Auth, phone + password, with an SMS OTP to prove the number.
//   Log in:   signInWithPassword          https://supabase.com/docs/guides/auth/passwords#signing-in-a-with-a-phone-number-and-password
//   Register: signInWithOtp -> verifyOtp -> updateUser({ password }) -> register_account() (role, server-side, see supabase/migrations)
//   Forgot:   signInWithOtp -> verifyOtp -> updateUser({ password })      (UNVERIFIED as one flow until tried with real SMS)
// OTP docs: https://supabase.com/docs/guides/auth/phone-login · Error codes: https://supabase.com/docs/guides/auth/debugging/error-codes
// Security note from Supabase: phone numbers get recycled by carriers, so a recycled number could reach an old account
// (https://supabase.com/docs/guides/auth/passwords). Adding MFA is the documented mitigation (not built yet).

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
      // Phone sign-in is switched off / no SMS provider on the Supabase project (an owner setup issue, not the user's).
      // VERIFIED 2026-10-11: with the Phone provider disabled even password login answers this ("Phone logins are disabled").
      case 'phone_provider_disabled':
        return new AuthError('SMS_FAILED', 'Phone login is not available right now. Please try again later.')
      // Wrong number OR wrong password: one message for both on purpose.
      case 'invalid_credentials':
        return new AuthError('WRONG_PASSWORD', 'Wrong mobile number or password.')
      case 'weak_password':
        return new AuthError('WEAK_PASSWORD', 'This password is too weak. Use a longer one with letters and numbers.')
      case 'same_password':
        return new AuthError('SAME_PASSWORD', 'Please choose a different password from your old one.')
      // sendOtp(reset) for an unknown number (shouldCreateUser:false). VERIFIED 2026-10-11 on the live project:
      // it answers `otp_disabled` (HTTP 422, "Signups not allowed for otp"). `signup_disabled` is a safe alias (unverified).
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
  async sendOtp(phone, purpose) {
    const { error } = await supabase.auth.signInWithOtp({
      phone: toE164(phone),
      options: { shouldCreateUser: purpose === 'register' },
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

  async setPassword(password) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw toAuthError(error, 'Could not save the password. Please try again.')
  },

  async register(role) {
    const { error } = await supabase.rpc('register_account', { p_role: role })
    // ALREADY_REGISTERED is fine here: the person proved they own the number, so just log them in.
    if (error && error.message !== 'ALREADY_REGISTERED') throw new AuthError('UNKNOWN', 'Could not create your account.')
    const user = await loadUser()
    if (!user) throw new AuthError('UNKNOWN', 'Could not load your account.')
    return user
  },

  async signInWithPassword(phone, password) {
    const { error } = await supabase.auth.signInWithPassword({ phone: toE164(phone), password })
    if (error) throw toAuthError(error, 'Could not log in. Please try again.')
    return loadUser()
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

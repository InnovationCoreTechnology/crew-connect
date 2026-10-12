import type { OtpPurpose, SignupRole, User } from '../types'

export type AuthErrorCode =
  | 'NOT_REGISTERED' // this number has no account
  | 'ALREADY_REGISTERED'
  | 'WRONG_PASSWORD' // wrong number or password (we never say which, so nobody can probe for registered numbers)
  | 'INVALID_OTP' // wrong code
  | 'OTP_EXPIRED'
  | 'TOO_MANY_ATTEMPTS' // this code is locked after too many wrong guesses: ask for a new one
  | 'RATE_LIMITED' // too many OTP requests: ask the user to wait
  | 'SMS_FAILED' // the SMS could not be sent (no gateway yet, or the gateway failed)
  | 'WEAK_PASSWORD' // refused by the server's password rules
  | 'SAME_PASSWORD' // the new password equals the old one
  | 'UNKNOWN'

// Services throw this so forms can show a friendly message per case.
export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

// The "contract" every auth backend must follow.
//   Log in:          signInWithPassword(phone, password)
//   Register:        sendOtp('register') -> checkOtp -> register(phone, otp, password, role)
//   Forgot password: sendOtp('reset')    -> checkOtp -> resetPassword(phone, otp, password)
// The OTP is checked once at its own step (so a wrong code is caught early) and again, for good, when the account is made
// or the password is changed: the server never trusts the browser to say "the OTP was fine".
export interface AuthService {
  // Texts a 6-digit OTP. `register` refuses a number that already has an account; `reset` refuses one that has none.
  sendOtp(phone: string, purpose: OtpPurpose): Promise<void>
  // Checks a code WITHOUT using it up. Throws INVALID_OTP / OTP_EXPIRED / TOO_MANY_ATTEMPTS.
  checkOtp(phone: string, purpose: OtpPurpose, otp: string): Promise<void>
  // Creates the account (login + role) and logs the person in. Re-checks the OTP on the server.
  register(phone: string, otp: string, password: string, role: SignupRole): Promise<User>
  // Sets a new password and logs the person in. Re-checks the OTP on the server.
  resetPassword(phone: string, otp: string, password: string): Promise<User>
  // Mobile number + password. Returns the user, or null when the login exists but has no account (should not happen).
  signInWithPassword(phone: string, password: string): Promise<User | null>
  // The current user (login session + role from the database), or null when logged out.
  getSession(): Promise<User | null>
  logout(): Promise<void>
  // Calls `callback` when the session ends elsewhere (other tab, expired). Returns an unsubscribe function.
  onSignedOut(callback: () => void): () => void
}

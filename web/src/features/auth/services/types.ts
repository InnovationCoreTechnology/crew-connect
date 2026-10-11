import type { OtpPurpose, SignupRole, User } from '../types'

export type AuthErrorCode =
  | 'NOT_REGISTERED' // this number has no account
  | 'ALREADY_REGISTERED'
  | 'WRONG_PASSWORD' // wrong number or password (we never say which, so nobody can probe for registered numbers)
  | 'INVALID_OTP' // wrong code
  | 'OTP_EXPIRED'
  | 'RATE_LIMITED' // too many SMS / requests: ask the user to wait
  | 'SMS_FAILED' // the SMS provider could not deliver, or phone login is switched off on the project
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
//   Register:        sendOtp('register') -> verifyOtp -> setPassword -> register(role)
//   Forgot password: sendOtp('reset')    -> verifyOtp -> setPassword
// Verifying an OTP signs the person in, which is what allows setPassword() to follow (Supabase requires a signed-in user).
export interface AuthService {
  // Sends a 6-digit OTP by SMS. `reset` refuses numbers that never registered; `register` creates the login.
  sendOtp(phone: string, purpose: OtpPurpose): Promise<void>
  // Checks the code and starts a session. Throws INVALID_OTP / OTP_EXPIRED.
  verifyOtp(phone: string, otp: string): Promise<void>
  // Sets (or replaces) the password of the signed-in user.
  setPassword(password: string): Promise<void>
  // Creates the account with the chosen role (server-side). Returns the user.
  register(role: SignupRole): Promise<User>
  // Mobile number + password. Returns the user, or null when the login exists but registration was never finished.
  signInWithPassword(phone: string, password: string): Promise<User | null>
  // The current user (login session + role from the database), or null when logged out.
  getSession(): Promise<User | null>
  logout(): Promise<void>
  // Calls `callback` when the session ends elsewhere (other tab, expired). Returns an unsubscribe function.
  onSignedOut(callback: () => void): () => void
}

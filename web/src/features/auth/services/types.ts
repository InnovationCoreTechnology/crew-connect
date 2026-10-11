import type { AuthMode, SignupRole, User } from '../types'

export type AuthErrorCode =
  | 'NOT_REGISTERED' // login for a number that never registered
  | 'ALREADY_REGISTERED'
  | 'INVALID_OTP' // wrong code
  | 'OTP_EXPIRED'
  | 'RATE_LIMITED' // too many SMS / requests: ask the user to wait
  | 'SMS_FAILED' // the SMS provider could not deliver
  | 'UNKNOWN'

// Services throw this so forms can show a friendly message per case.
export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

// The "contract" every auth backend must follow. Login is OTP-only (decision D4): there are no passwords.
export interface AuthService {
  // Sends a 6-digit OTP by SMS. `login` refuses numbers that never registered; `register` creates the login.
  sendOtp(phone: string, mode: AuthMode): Promise<void>
  // Checks the code and starts a session. Throws INVALID_OTP / OTP_EXPIRED.
  verifyOtp(phone: string, otp: string): Promise<void>
  // After a verified OTP: creates the account with the chosen role (server-side). Returns the user.
  register(role: SignupRole): Promise<User>
  // The current user (login session + role from the database), or null when logged out.
  getSession(): Promise<User | null>
  logout(): Promise<void>
  // Calls `callback` when the session ends elsewhere (other tab, expired). Returns an unsubscribe function.
  onSignedOut(callback: () => void): () => void
}

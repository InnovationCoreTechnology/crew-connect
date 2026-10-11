import type { Role, User } from '../types'

export type AuthErrorCode = 'NOT_REGISTERED' | 'WRONG_PASSWORD' | 'ALREADY_REGISTERED' | 'UNKNOWN'

// Services throw this so forms can show a friendly message per case.
export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

// The "contract" every auth backend must follow (fake one today, Supabase later).
export interface AuthService {
  isRegistered(phone: string): Promise<boolean>
  sendOtp(phone: string): Promise<void>
  verifyOtp(phone: string, otp: string): Promise<boolean>
  register(input: { phone: string; password: string; role: Role }): Promise<User>
  login(phone: string, password: string): Promise<User>
  logout(): Promise<void>
  getSession(): Promise<User | null>
}

import { createContext } from 'react'
import type { OtpPurpose, SignupRole, User } from '../types'

// Errors are thrown as AuthError (see services/types.ts) so each form can show a friendly message.
export interface AuthContextValue {
  user: User | null
  loading: boolean // true while we check if the user is already logged in
  // Returning user: mobile number + password.
  signIn: (phone: string, password: string) => Promise<User>
  // Step 2 of registering / resetting: checks the OTP. For `register` it refuses a number that already has an account;
  // for `reset` it refuses a number that has none. The user is NOT logged in to the app yet (see the two calls below).
  verifyOtp: (phone: string, otp: string, purpose: OtpPurpose) => Promise<void>
  // Step 3 of registering: saves the password, creates the account with the chosen role and logs the person in.
  completeRegistration: (password: string, role: SignupRole) => Promise<User>
  // Step 3 of a password reset: saves the new password and logs the person in.
  completeReset: (password: string) => Promise<User>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

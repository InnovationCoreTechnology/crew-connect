import { createContext } from 'react'
import type { OtpPurpose, SignupRole, User } from '../types'

// Errors are thrown as AuthError (see services/types.ts) so each form can show a friendly message.
export interface AuthContextValue {
  user: User | null
  loading: boolean // true while we check if the user is already logged in
  // Returning user: mobile number + password.
  signIn: (phone: string, password: string) => Promise<User>
  // Checks an OTP without using it up (the register / reset call below checks it again on the server).
  checkOtp: (phone: string, otp: string, purpose: OtpPurpose) => Promise<void>
  // New user: creates the account with the chosen role and logs the person in.
  register: (phone: string, otp: string, password: string, role: SignupRole) => Promise<User>
  // Forgot password: saves the new password and logs the person in.
  resetPassword: (phone: string, otp: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

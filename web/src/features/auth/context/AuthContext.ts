import { createContext } from 'react'
import type { SignupRole, User } from '../types'

export interface AuthContextValue {
  user: User | null
  loading: boolean // true while we check if the user is already logged in
  // Both end a successful OTP check with the user logged in. Errors are thrown as AuthError (see services/types.ts).
  signIn: (phone: string, otp: string) => Promise<User>
  signUp: (phone: string, otp: string, role: SignupRole) => Promise<User>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

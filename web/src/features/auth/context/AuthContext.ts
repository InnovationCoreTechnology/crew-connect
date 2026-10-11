import { createContext } from 'react'
import type { SignupRole, User } from '../types'

export interface AuthContextValue {
  user: User | null
  loading: boolean // true while we check if the user is already logged in
  login: (phone: string, password: string) => Promise<User>
  register: (input: { phone: string; password: string; role: SignupRole }) => Promise<User>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

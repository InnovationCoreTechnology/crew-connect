import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authService } from '../services'
import { AuthError } from '../services/types'
import type { OtpPurpose, SignupRole, User } from '../types'
import { AuthContext, type AuthContextValue } from './AuthContext'

// Keeps "who is logged in" for the whole app. Wrap the app with it once (see App.tsx).
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authService.getSession().then(setUser).finally(() => setLoading(false))
    // If the session ends elsewhere (another tab logs out, token no longer valid), leave the dashboard.
    return authService.onSignedOut(() => setUser(null))
  }, [])

  const signIn = useCallback(async (phone: string, password: string) => {
    const current = await authService.signInWithPassword(phone, password)
    if (!current) {
      // The password was right but there is no account behind this login: do not leave a half-made session behind.
      await authService.logout()
      throw new AuthError('NOT_REGISTERED', 'Your registration was not completed. Please register again.')
    }
    setUser(current)
    return current
  }, [])

  const checkOtp = useCallback((phone: string, otp: string, purpose: OtpPurpose) => authService.checkOtp(phone, purpose, otp), [])

  const register = useCallback(async (phone: string, otp: string, password: string, role: SignupRole) => {
    const created = await authService.register(phone, otp, password, role)
    setUser(created)
    return created
  }, [])

  const resetPassword = useCallback(async (phone: string, otp: string, password: string) => {
    const current = await authService.resetPassword(phone, otp, password)
    setUser(current)
    return current
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signIn, checkOtp, register, resetPassword, logout }),
    [user, loading, signIn, checkOtp, register, resetPassword, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

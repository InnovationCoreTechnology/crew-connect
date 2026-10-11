import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authService } from '../services'
import { AuthError } from '../services/types'
import type { SignupRole, User } from '../types'
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

  const signIn = useCallback(async (phone: string, otp: string) => {
    await authService.verifyOtp(phone, otp)
    const current = await authService.getSession()
    if (!current) {
      // The OTP was right but this number never registered: do not leave a half-made login behind.
      await authService.logout()
      throw new AuthError('NOT_REGISTERED', 'This number is not registered.')
    }
    setUser(current)
    return current
  }, [])

  const signUp = useCallback(async (phone: string, otp: string, role: SignupRole) => {
    await authService.verifyOtp(phone, otp)
    const created = await authService.register(role)
    setUser(created)
    return created
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signIn, signUp, logout }),
    [user, loading, signIn, signUp, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

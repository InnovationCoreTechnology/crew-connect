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
      // The password was right but registration was never finished: do not leave a half-made login behind.
      await authService.logout()
      throw new AuthError('NOT_REGISTERED', 'Your registration was not completed. Please register again.')
    }
    setUser(current)
    return current
  }, [])

  const verifyOtp = useCallback(async (phone: string, otp: string, purpose: OtpPurpose) => {
    await authService.verifyOtp(phone, otp) // this signs the person in at Supabase, but not yet in the app (user stays null)
    const existing = await authService.getSession() // non-null = this number already has a complete account
    if (purpose === 'register' && existing) {
      await authService.logout()
      throw new AuthError('ALREADY_REGISTERED', 'This number is already registered.')
    }
    if (purpose === 'reset' && !existing) {
      await authService.logout()
      throw new AuthError('NOT_REGISTERED', 'This number is not registered.')
    }
  }, [])

  const completeRegistration = useCallback(async (password: string, role: SignupRole) => {
    await authService.setPassword(password)
    const created = await authService.register(role)
    setUser(created)
    return created
  }, [])

  const completeReset = useCallback(async (password: string) => {
    await authService.setPassword(password)
    const current = await authService.getSession()
    if (!current) throw new AuthError('NOT_REGISTERED', 'This number is not registered.')
    setUser(current)
    return current
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signIn, verifyOtp, completeRegistration, completeReset, logout }),
    [user, loading, signIn, verifyOtp, completeRegistration, completeReset, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

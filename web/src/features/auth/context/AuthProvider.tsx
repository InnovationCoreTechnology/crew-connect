import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authService } from '../services'
import type { Role, User } from '../types'
import { AuthContext, type AuthContextValue } from './AuthContext'

// Keeps "who is logged in" for the whole app. Wrap the app with it once (see App.tsx).
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authService.getSession().then(setUser).finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (phone: string, password: string) => {
    const loggedIn = await authService.login(phone, password)
    setUser(loggedIn)
    return loggedIn
  }, [])

  const register = useCallback(async (input: { phone: string; password: string; role: Role }) => {
    const created = await authService.register(input)
    setUser(created)
    return created
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

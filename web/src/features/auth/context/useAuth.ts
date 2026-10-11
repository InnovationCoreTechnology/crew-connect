import { useContext } from 'react'
import { AuthContext } from './AuthContext'

// Use this in any component: const { user, logout } = useAuth()
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}

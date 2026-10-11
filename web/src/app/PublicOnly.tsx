import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/context/useAuth'
import { homePathFor } from './paths'

// Wrap the login page with this. A logged-in user is sent straight to their dashboard.
// This is also what moves the user forward right after a successful login or registration.
export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="center-note">Loading…</p>
  if (user) return <Navigate to={homePathFor(user.role)} replace />
  return <>{children}</>
}

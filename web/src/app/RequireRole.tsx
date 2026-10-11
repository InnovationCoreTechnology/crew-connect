import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/context/useAuth'
import type { Role } from '../features/auth/types'
import { PATHS, homePathFor } from './paths'

// Wrap a page with this to protect it.
// Not logged in -> login page. Wrong role -> that user's own dashboard.
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="center-note">Loading…</p>
  if (!user) return <Navigate to={PATHS.login} replace />
  if (user.role !== role) return <Navigate to={homePathFor(user.role)} replace />
  return <>{children}</>
}

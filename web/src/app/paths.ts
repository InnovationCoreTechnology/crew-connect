import type { Role } from '../features/auth/types'

// All page addresses live here. If a URL changes, change it only in this file.
export const PATHS = {
  login: '/login',
  candidate: '/candidate',
  employer: '/employer',
  // TODO (Admin): add `admin: '/admin'` here when you build the admin panel.
} as const

export const homePathFor = (role: Role): string => PATHS[role]

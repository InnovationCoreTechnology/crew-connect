import type { Role } from '../features/auth/types'

// All page addresses live here. If a URL changes, change it only in this file.
export const PATHS = {
  login: '/login',
  candidate: '/candidate',
  employer: '/employer',
  admin: '/admin',
} as const

export const homePathFor = (role: Role): string => PATHS[role]

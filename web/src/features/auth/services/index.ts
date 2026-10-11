import { mockAuthService } from './mockAuthService'
import type { AuthService } from './types'

// The ONLY place that decides which backend is used.
// TODO (Supabase): import supabaseAuthService and export it here instead of the mock.
export const authService: AuthService = mockAuthService

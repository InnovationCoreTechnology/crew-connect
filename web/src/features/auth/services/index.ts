import { supabaseAuthService } from './supabaseAuthService'
import type { AuthService } from './types'

// The ONLY place that decides which auth backend is used.
export const authService: AuthService = supabaseAuthService

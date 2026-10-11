import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// ONE shared Supabase client for the whole app (login session, database calls).
// Why one: it keeps the login session and refreshes the token in a single place.
// Why <Database>: the generated types make the compiler check every table/function call against the real schema.
// Only data/api.ts and features/auth/services use it; screens never import it directly.
// Docs: https://supabase.com/docs/reference/javascript/initializing
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy web/.env.example to web/.env.local and fill both.')
}

export const supabase = createClient<Database>(url, key)

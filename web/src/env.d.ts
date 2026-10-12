/// <reference types="vite/client" />

// Types for the variables we read from .env.local (see web/.env.example). Vite only exposes names starting with VITE_.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  readonly VITE_TURNSTILE_SITE_KEY?: string // optional: without it no CAPTCHA widget is shown (dev only; see supabase/README.md)
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}

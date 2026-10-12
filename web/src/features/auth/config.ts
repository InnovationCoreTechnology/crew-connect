// All login/registration rules in one place. Change a rule here and every form follows.
export const AUTH_CONFIG = {
  phonePattern: /^[6-9]\d{9}$/, // Indian mobile: 10 digits, starts with 6, 7, 8 or 9
  phoneLength: 10,
  countryCode: '+91', // the app is India-only for now; shown next to the number (the number itself is stored as 10 digits)
  // OTP length is decided by our own OTP system (6 digits, see supabase/migrations/20261011140000_own_otp_accounts.sql).
  otpLength: 6,
  // Tries are counted here only to keep the screen friendly. The real limits (cooldown, codes per hour, 5 wrong guesses per
  // code, expiry) are enforced in the database: table app_settings (otp_*).
  maxOtpTries: 3,
  // Supabase's own guidance: "Anything less than 8 characters is not recommended" (https://supabase.com/docs/guides/auth/password-security).
  // The project's server-side minimum (dashboard -> Authentication) must be the same or lower, or Supabase answers `weak_password`.
  minPasswordLength: 8,
  // Cloudflare Turnstile site key (public). Empty = no widget is shown and no token is sent (dev only: the server then accepts only
  // the dev test numbers). Create the real widget in the Cloudflare dashboard; it needs the hostnames the site is served from.
  turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '',
  resendSeconds: 60, // same as app_settings.otp_resend_seconds in the database (the database is what enforces it)
} as const

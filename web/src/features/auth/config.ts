// All login/registration rules in one place. Change a rule here and every form follows.
export const AUTH_CONFIG = {
  phonePattern: /^[6-9]\d{9}$/, // Indian mobile: 10 digits, starts with 6, 7, 8 or 9
  phoneLength: 10,
  countryCode: '+91', // the app is India-only for now; Supabase needs the number in E.164 format (+919845000001)
  // Supabase phone OTPs are 6 digits by default: https://supabase.com/docs/guides/auth/phone-login
  otpLength: 6,
  // Tries are counted here only to keep the screen friendly. The real limits (SMS per number, per hour, OTP expiry)
  // are enforced by Supabase Auth: dashboard -> Authentication -> Rate Limits.
  maxOtpTries: 3,
  // Supabase's own guidance: "Anything less than 8 characters is not recommended" (https://supabase.com/docs/guides/auth/password-security).
  // The project's server-side minimum (dashboard -> Authentication) must be the same or lower, or Supabase answers `weak_password`.
  minPasswordLength: 8,
  resendSeconds: 60, // Supabase allows one OTP per phone per ~60 seconds by default
} as const

// All login/registration rules in one place. Change a rule here and every form follows.
export const AUTH_CONFIG = {
  phonePattern: /^[6-9]\d{9}$/, // Indian mobile: 10 digits, starts with 6, 7, 8 or 9
  phoneLength: 10,
  otpLength: 4, // TODO: most SMS providers send 6 digits. Change to 6 when real SMS is connected.
  maxOtpTries: 3,
  resendSeconds: 30,
  minPasswordLength: 6,
  // TODO (Remove before launch): the fake OTP used while there is no SMS provider.
  // Real flow: Supabase Auth phone OTP + MSG91 / Fast2SMS (needs DLT registration in India).
  demoOtp: '1234',
} as const

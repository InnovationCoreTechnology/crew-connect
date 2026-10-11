import { AUTH_CONFIG } from './config'

// Each function returns an error message, or '' when the value is fine.
// Keep them pure (no React) so they are easy to test and reuse.

export function validatePhone(value: string): string {
  if (!value) return 'Enter your mobile number.'
  if (!AUTH_CONFIG.phonePattern.test(value)) {
    return 'Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.'
  }
  return ''
}

export function validateOtp(value: string): string {
  if (!value) return 'Enter the OTP.'
  if (!/^\d+$/.test(value) || value.length !== AUTH_CONFIG.otpLength) return `OTP must be ${AUTH_CONFIG.otpLength} digits.`
  return ''
}

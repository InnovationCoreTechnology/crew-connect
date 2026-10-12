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

export function validateLoginPassword(value: string): string {
  return value ? '' : 'Enter your password.'
}

export function validateNewPassword(password: string, phone: string): string {
  if (!password) return 'Create a password.'
  if (/\s/.test(password)) return 'Password cannot have spaces.'
  if (password.length > 72) return 'Use at most 72 characters.' // Supabase hashes passwords with bcrypt, which only reads 72 bytes
  if (password.length < AUTH_CONFIG.minPasswordLength) {
    return `Use at least ${AUTH_CONFIG.minPasswordLength} characters.`
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Include at least one letter and one number.'
  }
  if (password.includes(phone)) return 'Password cannot contain your mobile number.'
  return ''
}

export function validateConfirm(password: string, confirm: string): string {
  if (!confirm) return 'Confirm your password.'
  if (password !== confirm) return 'Passwords do not match.'
  return ''
}

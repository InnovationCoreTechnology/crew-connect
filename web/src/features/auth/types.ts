// Roles a person can choose when registering. Admin is NOT here: admins are created manually.
export type SignupRole = 'candidate' | 'employer'
export type Role = SignupRole | 'admin'

export interface User {
  id: string
  phone: string
  role: Role
}

// Which screen is shown. `forgot` = reset a forgotten password.
export type AuthMode = 'login' | 'register' | 'forgot'
// Why an OTP is requested: to create an account, or to prove ownership of the number when resetting a password.
export type OtpPurpose = 'register' | 'reset'

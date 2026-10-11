// Roles a person can choose when registering. Admin is NOT here: admins are created manually.
export type SignupRole = 'candidate' | 'employer'
export type Role = SignupRole | 'admin'

export interface User {
  id: string
  phone: string
  role: Role
}

export type AuthMode = 'login' | 'register'

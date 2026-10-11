export type Role = 'candidate' | 'employer'
// TODO (Admin): extend to 'candidate' | 'employer' | 'admin' when the admin panel is built.

export interface User {
  id: string
  phone: string
  role: Role
}

export type AuthMode = 'login' | 'register'

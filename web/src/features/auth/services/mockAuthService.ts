import { AUTH_CONFIG } from '../config'
import type { User } from '../types'
import { AuthError, type AuthService } from './types'

// FAKE backend for development. It keeps users in the browser (localStorage).
// TODO (Replace): write supabaseAuthService.ts with the same functions, then switch it in services/index.ts.
// TODO (Security): this stores passwords as plain text ONLY because it is a fake. Never do this for real.

const USERS_KEY = 'crewconnect_users'
const SESSION_KEY = 'crewconnect_session'

interface StoredUser extends User {
  password: string
}

// Test accounts so you can log in without registering.
const SEED_USERS: StoredUser[] = [
  { id: 'u1', phone: '9845000001', role: 'candidate', password: 'demo123' },
  { id: 'u2', phone: '9845000002', role: 'employer', password: 'demo123' },
  // Admin is created by you, never by self-registration. TODO: in Supabase, set role 'admin' manually.
  { id: 'admin1', phone: '9845000000', role: 'admin', password: 'demo123' },
]

const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms)) // pretend the network is slow
const toUser = (u: StoredUser): User => ({ id: u.id, phone: u.phone, role: u.role })

function readUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    const saved = raw ? (JSON.parse(raw) as StoredUser[]) : []
    // Always keep the test accounts available, even if older data was saved.
    return [...SEED_USERS.filter((s) => !saved.some((u) => u.phone === s.phone)), ...saved]
  } catch {
    return SEED_USERS
  }
}

function writeUsers(users: StoredUser[]) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  } catch {
    // Storage can be blocked (private mode). The app still works until refresh.
  }
}

function saveSession(user: User | null) {
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

export const mockAuthService: AuthService = {
  async isRegistered(phone) {
    await wait()
    return readUsers().some((u) => u.phone === phone)
  },

  async sendOtp(phone) {
    await wait()
    console.info(`[mock] OTP for ${phone} is ${AUTH_CONFIG.demoOtp}`)
  },

  async verifyOtp(_phone, otp) {
    await wait()
    return otp === AUTH_CONFIG.demoOtp
  },

  async register({ phone, password, role }) {
    await wait()
    const users = readUsers()
    if (users.some((u) => u.phone === phone)) {
      throw new AuthError('ALREADY_REGISTERED', 'This number is already registered.')
    }
    const created: StoredUser = { id: `u${Date.now()}`, phone, role, password }
    writeUsers([...users, created])
    const user = toUser(created)
    saveSession(user)
    // TODO (Employer): create the employer record with the free unlocks here (on the server).
    return user
  },

  async login(phone, password) {
    await wait()
    const found = readUsers().find((u) => u.phone === phone)
    if (!found) throw new AuthError('NOT_REGISTERED', 'This number is not registered.')
    if (found.password !== password) throw new AuthError('WRONG_PASSWORD', 'Wrong password.')
    const user = toUser(found)
    saveSession(user)
    return user
  },

  async logout() {
    saveSession(null)
  },

  async getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  },
}

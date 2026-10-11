import { AREAS, JOB_TYPES, SHIFTS } from '../app/config'
import type { Application, CandidateProfile, Employer, Job } from './types'

// FAKE database kept in memory. It resets when you refresh the page.
// TODO (Supabase): delete this file once api.ts talks to real tables
//   (candidates, employers, jobs, applications, unlocks).

const NAMES = [
  'Ravi Kumar', 'Suresh Gowda', 'Manjunath R', 'Lakshmi Devi', 'Anita Kumari', 'Mohammed Irfan', 'Prakash S',
  'Savitha M', 'Ramesh Naik', 'Geetha B', 'Venkatesh P', 'Shanthi K', 'Arun Raj', 'Nagaraj H', 'Meena Kumari',
  'Basavaraj L', 'Pooja S', 'Imran Khan', 'Kavitha R', 'Dinesh Kumar',
]

const candidates: CandidateProfile[] = NAMES.map((name, i) => ({
  id: i === 0 ? 'u1' : `c${i + 1}`, // 'u1' is the demo login 9845000001
  phone: i === 0 ? '9845000001' : `98${45000000 + i * 137911}`,
  name,
  type: JOB_TYPES[i % 2],
  exp: (i * 3) % 11,
  area: AREAS[(i * 5) % 8],
  salary: (12 + ((i * 7) % 9)) * 1000,
  shift: SHIFTS[i % 3],
  avail: i % 4 ? 'Immediate' : '15 days',
  verified: i % 3 !== 1,
  blocked: false,
}))

const employers: Employer[] = [
  { id: 'u2', phone: '9845000002', companyName: 'Prestige Facility Services', status: 'Approved', freeUnlocksLeft: 3, spentInr: 0 }, // demo login
  { id: 'e2', phone: '9900000002', companyName: 'Sunrise Apartments Association', status: 'Pending', freeUnlocksLeft: 3, spentInr: 0 },
  { id: 'e3', phone: '9900000003', companyName: 'Metro Housekeeping Co.', status: 'Pending', freeUnlocksLeft: 3, spentInr: 0 },
  { id: 'e4', phone: '9900000004', companyName: 'SafeGuard Security Agency', status: 'Approved', freeUnlocksLeft: 3, spentInr: 0 },
]

const jobs: Job[] = [
  { id: 'j1', employerId: 'u2', title: 'Security Guard – Apartment Gate', type: 'Security', area: 'Whitefield', salary: 18000, shift: 'Night', openings: 4 },
  { id: 'j2', employerId: 'e4', title: 'Security Supervisor', type: 'Security', area: 'Koramangala', salary: 24000, shift: 'Day', openings: 1 },
  { id: 'j3', employerId: 'u2', title: 'Housekeeping Staff – Office', type: 'Housekeeping', area: 'Marathahalli', salary: 15000, shift: 'Day', openings: 6 },
  { id: 'j4', employerId: 'e4', title: 'Housekeeping Supervisor', type: 'Housekeeping', area: 'HSR Layout', salary: 21000, shift: 'Day', openings: 2 },
  { id: 'j5', employerId: 'e2', title: 'Security Guard – Society', type: 'Security', area: 'Yelahanka', salary: 16000, shift: 'Any', openings: 3 },
]

const applications: Application[] = [{ jobId: 'j2', candidateId: 'u1', status: 'Shortlisted' }]

export const db = {
  candidates,
  employers,
  jobs,
  applications,
  unlocks: new Set<string>(), // "employerId:candidateId"
}

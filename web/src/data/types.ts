import type { AVAILABILITY, JobType, SHIFTS } from '../app/config'

export type Shift = (typeof SHIFTS)[number]
export type Availability = (typeof AVAILABILITY)[number]
export type EmployerStatus = 'Pending' | 'Approved' | 'Blocked'
export type ApplicationStatus = 'Applied' | 'Shortlisted' | 'Rejected'

// A candidate's own profile. The phone number is not part of it: the person already knows it (it is their login).
export interface CandidateProfile {
  id: string // same as the login user id
  name: string // empty until the candidate completes the profile
  type: JobType
  exp: number // years
  area: string
  salary: number // expected, INR per month
  shift: Shift
  avail: Availability
  verified: boolean // set by admin after the ID check
  blocked: boolean // set by admin
}

// What the ADMIN sees: a profile plus the phone number.
export interface AdminCandidate extends CandidateProfile {
  phone: string
}

// What an EMPLOYER may see. `phone` is null until that employer unlocks the candidate.
// Blocked candidates are never sent to employers, so there is no `blocked` field.
export interface CandidateCardData extends Omit<CandidateProfile, 'blocked'> {
  phone: string | null
  maskedPhone: string
}

export interface Employer {
  id: string
  companyName: string
  status: EmployerStatus // new employers start as Pending until admin approves
  freeUnlocksLeft: number
  spentInr: number
}
export interface EmployerAccount extends Employer {
  unlockedCount: number
}
export interface AdminEmployer extends Employer {
  phone: string
}

// A job as candidates see it.
export interface Job {
  id: string
  title: string
  type: JobType
  area: string
  salary: number
  shift: Shift
  openings: number
}
export interface JobWithCompany extends Job {
  companyName: string
}

export interface ApplicationView {
  job: JobWithCompany
  status: ApplicationStatus
  appliedAt: string // ISO time the candidate applied
}

export interface CandidateFilters {
  type: JobType | 'All'
  minExp: number
  area: string // 'All' or one of AREAS
  maxSalary: number // 0 = any
  shift: Shift | 'All'
  verifiedOnly: boolean
  query: string
}

export interface AdminStats {
  candidates: number
  employers: number
  pendingEmployers: number
  jobs: number
  unlocks: number
  revenueInr: number
}

// Paging. The server returns the newest rows first; `next` is where the following page starts
// (null = this was the last page). Keyset ("cursor") paging keeps every page equally fast, however deep.
export interface Cursor {
  createdAt: string
  id: string
}
export interface Page<T> {
  items: T[]
  next: Cursor | null
}

// Admin tables show the newest rows only. `truncated` = there are more than were returned.
export interface AdminList<T> {
  items: T[]
  truncated: boolean
}

// What the server answers to "unlock this candidate": the number plus the employer's updated counters.
export interface UnlockResult {
  phone: string
  freeUnlocksLeft: number
  spentInr: number
  unlockedCount: number
}

import type { AVAILABILITY, JobType, SHIFTS } from '../app/config'

export type Shift = (typeof SHIFTS)[number]
export type Availability = (typeof AVAILABILITY)[number]
export type EmployerStatus = 'Pending' | 'Approved' | 'Blocked'
export type ApplicationStatus = 'Applied' | 'Shortlisted' | 'Rejected'

export interface CandidateProfile {
  id: string // same as the login user id
  phone: string
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

// What an EMPLOYER may see. `phone` is null until that employer unlocks the candidate.
export interface CandidateCardData extends Omit<CandidateProfile, 'phone'> {
  phone: string | null
  maskedPhone: string
}

export interface Employer {
  id: string
  phone: string
  companyName: string
  status: EmployerStatus // new employers start as Pending until admin approves
  freeUnlocksLeft: number
  spentInr: number
}
export interface EmployerAccount extends Employer {
  unlockedCount: number
}

export interface Job {
  id: string
  employerId: string
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

export interface Application {
  jobId: string
  candidateId: string
  status: ApplicationStatus
}
export interface ApplicationView {
  job: JobWithCompany
  status: ApplicationStatus
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

import { AREAS, PRICING } from '../app/config'
import { db } from './mockDb'
import { isProfileComplete, maskPhone, unlockBlockReason } from './rules'
import type {
  AdminStats, ApplicationView, CandidateCardData, CandidateFilters, CandidateProfile,
  Employer, EmployerAccount, EmployerStatus, Job, JobWithCompany,
} from './types'
import type { JobType } from '../app/config'

// THE data layer. Screens call ONLY these functions and never touch mockDb directly.
// TODO (Supabase): keep every function name and return type, replace the body with a Supabase call.
// Rules marked "SERVER RULE" must be enforced in the database (RLS policies / SQL functions), not in the browser.

export type ApiErrorCode = 'NOT_FOUND' | 'NOT_APPROVED' | 'PROFILE_INCOMPLETE' | 'BLOCKED'
export class ApiError extends Error {
  code: ApiErrorCode
  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

const wait = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms)) // pretend the network is slow
const unlockKey = (employerId: string, candidateId: string) => `${employerId}:${candidateId}`
const isApproved = (employerId: string) => db.employers.find((e) => e.id === employerId)?.status === 'Approved'
const withCompany = (j: Job): JobWithCompany => ({
  ...j,
  companyName: db.employers.find((e) => e.id === j.employerId)?.companyName || 'Company',
})
const toCard = (c: CandidateProfile, unlocked: boolean): CandidateCardData => ({
  ...c,
  phone: unlocked ? c.phone : null, // SERVER RULE: never send the number before unlock
  maskedPhone: maskPhone(c.phone),
})
const toAccount = (e: Employer): EmployerAccount => ({
  ...e,
  unlockedCount: [...db.unlocks].filter((k) => k.startsWith(`${e.id}:`)).length,
})

/* ---------------- Candidate ---------------- */

export async function getCandidateProfile(userId: string, phone: string): Promise<CandidateProfile> {
  await wait()
  let found = db.candidates.find((c) => c.id === userId)
  if (!found) {
    // First visit after registration: start with an empty profile.
    found = {
      id: userId, phone, name: '', type: 'Security', exp: 0, area: AREAS[0],
      salary: 15000, shift: 'Any', avail: 'Immediate', verified: false, blocked: false,
    }
    db.candidates.push(found)
  }
  return { ...found }
}

// Candidates can edit only these fields. `verified` and `blocked` belong to the admin.
export async function saveCandidateProfile(p: CandidateProfile): Promise<CandidateProfile> {
  await wait()
  const found = db.candidates.find((c) => c.id === p.id)
  if (!found) throw new ApiError('NOT_FOUND', 'Profile not found.')
  Object.assign(found, {
    name: p.name.trim(), type: p.type, exp: p.exp, area: p.area, salary: p.salary, shift: p.shift, avail: p.avail,
  })
  return { ...found }
}

export async function listJobs(type: JobType | 'All'): Promise<JobWithCompany[]> {
  await wait()
  // Only jobs of approved employers are shown.
  return db.jobs.filter((j) => isApproved(j.employerId) && (type === 'All' || j.type === type)).map(withCompany)
}

export async function listApplications(candidateId: string): Promise<ApplicationView[]> {
  await wait()
  const views: ApplicationView[] = []
  for (const a of db.applications.filter((x) => x.candidateId === candidateId)) {
    const job = db.jobs.find((j) => j.id === a.jobId)
    if (job) views.push({ job: withCompany(job), status: a.status })
  }
  return views
}

export async function applyToJob(candidateId: string, jobId: string): Promise<void> {
  await wait()
  const candidate = db.candidates.find((c) => c.id === candidateId)
  if (!candidate) throw new ApiError('NOT_FOUND', 'Profile not found.')
  if (candidate.blocked) throw new ApiError('BLOCKED', 'Your account is blocked. Please contact support.')
  if (!isProfileComplete(candidate)) throw new ApiError('PROFILE_INCOMPLETE', 'Complete your profile before applying.')
  if (db.applications.some((a) => a.candidateId === candidateId && a.jobId === jobId)) return
  db.applications.push({ jobId, candidateId, status: 'Applied' })
}

/* ---------------- Employer ---------------- */

export async function getEmployerAccount(userId: string, phone: string): Promise<EmployerAccount> {
  await wait()
  let found = db.employers.find((e) => e.id === userId)
  if (!found) {
    // New employer: waits for admin approval. TODO: collect company name + GST/CIN at this point.
    found = { id: userId, phone, companyName: '', status: 'Pending', freeUnlocksLeft: PRICING.freeUnlocksForNewEmployer, spentInr: 0 }
    db.employers.push(found)
  }
  return toAccount(found)
}

export async function listCandidates(employerId: string, f: CandidateFilters): Promise<CandidateCardData[]> {
  await wait()
  const query = f.query.trim().toLowerCase()
  return db.candidates
    .filter((c) =>
      !c.blocked && isProfileComplete(c) // blocked and unfinished profiles are hidden
      && (f.type === 'All' || c.type === f.type)
      && c.exp >= f.minExp
      && (f.area === 'All' || c.area === f.area)
      && (f.maxSalary === 0 || c.salary <= f.maxSalary)
      && (f.shift === 'All' || c.shift === f.shift || c.shift === 'Any')
      && (!f.verifiedOnly || c.verified)
      && c.name.toLowerCase().includes(query))
    .map((c) => toCard(c, db.unlocks.has(unlockKey(employerId, c.id))))
}

export async function listUnlocked(employerId: string): Promise<CandidateCardData[]> {
  await wait()
  return db.candidates.filter((c) => db.unlocks.has(unlockKey(employerId, c.id))).map((c) => toCard(c, true))
}

// SERVER RULE: do all of this in ONE database function so nobody can cheat from the browser.
export async function unlockCandidate(employerId: string, candidateId: string): Promise<{ account: EmployerAccount }> {
  await wait()
  const employer = db.employers.find((e) => e.id === employerId)
  const candidate = db.candidates.find((c) => c.id === candidateId)
  if (!employer || !candidate || candidate.blocked) throw new ApiError('NOT_FOUND', 'This candidate is no longer available.')
  if (employer.status !== 'Approved') throw new ApiError('NOT_APPROVED', unlockBlockReason(employer))
  const key = unlockKey(employerId, candidateId)
  if (!db.unlocks.has(key)) {
    if (employer.freeUnlocksLeft > 0) employer.freeUnlocksLeft -= 1
    else employer.spentInr += PRICING.pricePerUnlockInr // TODO: take real payment (Razorpay wallet) here
    db.unlocks.add(key)
  }
  return { account: toAccount(employer) }
}

/* ---------------- Admin ---------------- */

export async function getAdminStats(): Promise<AdminStats> {
  await wait()
  return {
    candidates: db.candidates.filter((c) => !c.blocked && isProfileComplete(c)).length,
    employers: db.employers.length,
    pendingEmployers: db.employers.filter((e) => e.status === 'Pending').length,
    jobs: db.jobs.length,
    unlocks: db.unlocks.size,
    revenueInr: db.employers.reduce((sum, e) => sum + e.spentInr, 0),
  }
}

export async function listEmployers(): Promise<Employer[]> {
  await wait()
  return db.employers.map((e) => ({ ...e }))
}

export async function setEmployerStatus(id: string, status: EmployerStatus): Promise<void> {
  await wait()
  const found = db.employers.find((e) => e.id === id)
  if (!found) throw new ApiError('NOT_FOUND', 'Employer not found.')
  found.status = status
}

export async function listCandidatesForAdmin(): Promise<CandidateProfile[]> {
  await wait()
  return db.candidates.map((c) => ({ ...c }))
}

export async function setCandidateFlag(id: string, flag: 'verified' | 'blocked', value: boolean): Promise<void> {
  await wait()
  const found = db.candidates.find((c) => c.id === id)
  if (!found) throw new ApiError('NOT_FOUND', 'Candidate not found.')
  found[flag] = value
}

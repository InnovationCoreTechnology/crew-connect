import type { PostgrestError } from '@supabase/supabase-js'
import { AVAILABILITY, JOB_TYPES, LIST_PAGE_SIZE, SHIFTS } from '../app/config'
import type { JobType } from '../app/config'
import type { Database } from '../lib/database.types'
import { supabase } from '../lib/supabase'
import type {
  AdminCandidate, AdminEmployer, AdminList, AdminStats, ApplicationStatus, ApplicationView, CandidateCardData,
  CandidateFilters, CandidateProfile, Cursor, EmployerAccount, EmployerStatus, JobWithCompany, Page, UnlockResult,
} from './types'

// THE data layer. Screens call ONLY these functions and never touch Supabase directly.
// Every rule that protects money or private data runs in the database (supabase/migrations/*):
//   - Row Level Security decides which rows a user can read or edit,
//   - SQL functions (unlock_candidate, search_candidates, admin_*) do the multi-step rules in ONE transaction.
// The browser only asks. Do not move those rules into this file.
// Docs: https://supabase.com/docs/reference/javascript/rpc

type Fn = Database['public']['Functions']
type CardRow = Fn['search_candidates']['Returns'][number]

/* ---------------- Errors ---------------- */

export type ApiErrorCode = 'NOT_FOUND' | 'NOT_APPROVED' | 'PROFILE_INCOMPLETE' | 'BLOCKED' | 'FORBIDDEN' | 'UNKNOWN'
export class ApiError extends Error {
  code: ApiErrorCode
  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

const MESSAGES: Record<ApiErrorCode, string> = {
  NOT_FOUND: 'This item is no longer available.',
  NOT_APPROVED: 'You cannot unlock numbers yet. Please check your account status.',
  PROFILE_INCOMPLETE: 'Complete your profile before applying.',
  BLOCKED: 'Your account is blocked. Please contact support.',
  FORBIDDEN: 'You do not have access to this.',
  UNKNOWN: 'Something went wrong. Please try again.',
}
const KNOWN_CODES = Object.keys(MESSAGES) as ApiErrorCode[]

// Our SQL functions raise short codes as the error message (NOT_APPROVED, NOT_FOUND, ...). Anything else is UNKNOWN.
function fail(error: PostgrestError): never {
  const code: ApiErrorCode =
    error.code === 'PGRST116' ? 'NOT_FOUND' // "no row" from .single()
      : KNOWN_CODES.find((c) => c === error.message) ?? 'UNKNOWN'
  throw new ApiError(code, MESSAGES[code])
}

/* ---------------- Mapping helpers ---------------- */

// The database CHECK constraints already guarantee these values; this narrows `string` to our union types
// and fails loudly if the two ever drift apart.
function oneOf<T extends string>(allowed: readonly T[], value: string): T {
  const found = allowed.find((a) => a === value)
  if (found === undefined) throw new ApiError('UNKNOWN', MESSAGES.UNKNOWN)
  return found
}

function toCard(r: CardRow): CandidateCardData {
  return {
    id: r.id, name: r.name, type: oneOf(JOB_TYPES, r.type), exp: r.exp, area: r.area, salary: r.salary,
    shift: oneOf(SHIFTS, r.shift), avail: oneOf(AVAILABILITY, r.avail), verified: r.verified,
    phone: r.phone ?? null, // the generated type says string, but the server sends null until unlocked
    maskedPhone: r.phone_masked,
  }
}

type ProfileRow = Pick<Database['public']['Tables']['candidates']['Row'],
  'id' | 'name' | 'type' | 'exp' | 'area' | 'salary' | 'shift' | 'avail' | 'verified' | 'blocked'>

const toProfile = (r: ProfileRow): CandidateProfile => ({
  id: r.id, name: r.name, type: oneOf(JOB_TYPES, r.type), exp: r.exp, area: r.area, salary: r.salary,
  shift: oneOf(SHIFTS, r.shift), avail: oneOf(AVAILABILITY, r.avail), verified: r.verified, blocked: r.blocked,
})

const toJob = (r: Fn['list_jobs']['Returns'][number]): JobWithCompany => ({
  id: r.id, title: r.title, type: oneOf(JOB_TYPES, r.type), area: r.area, salary: r.salary,
  shift: oneOf(SHIFTS, r.shift), openings: r.openings, companyName: r.company_name || 'Company',
})

// The server returns up to LIST_PAGE_SIZE + 1 rows: the extra one only means "there is another page".
function toPage<R extends { id: string; created_at: string }, T>(rows: R[], map: (r: R) => T): Page<T> {
  const hasMore = rows.length > LIST_PAGE_SIZE
  const shown = hasMore ? rows.slice(0, LIST_PAGE_SIZE) : rows
  const last = shown[shown.length - 1]
  return { items: shown.map(map), next: hasMore && last ? { createdAt: last.created_at, id: last.id } : null }
}

const cursorArgs = (cursor?: Cursor) => ({ p_after_created_at: cursor?.createdAt, p_after_id: cursor?.id })

/* ---------------- Candidate ---------------- */

const PROFILE_COLUMNS = 'id,name,type,exp,area,salary,shift,avail,verified,blocked' as const

export async function getCandidateProfile(userId: string): Promise<CandidateProfile> {
  // RLS lets a candidate read only their own row; the filter is still added so Postgres plans it as a key lookup.
  const { data, error } = await supabase.from('candidates').select(PROFILE_COLUMNS).eq('id', userId).single()
  if (error) fail(error)
  return toProfile(data)
}

// Candidates can edit only these fields. `verified` and `blocked` belong to the admin: the database refuses the
// change even if someone calls the API by hand (column-level GRANT, see supabase/migrations).
export async function saveCandidateProfile(p: CandidateProfile): Promise<CandidateProfile> {
  const { data, error } = await supabase
    .from('candidates')
    .update({ name: p.name.trim(), type: p.type, exp: p.exp, area: p.area, salary: p.salary, shift: p.shift, avail: p.avail })
    .eq('id', p.id)
    .select(PROFILE_COLUMNS)
    .single()
  if (error) fail(error)
  return toProfile(data)
}

// Only jobs of approved employers are returned (the database filters them). Capped at 100 until roadmap item 4.5.
export async function listJobs(type: JobType | 'All'): Promise<JobWithCompany[]> {
  const { data, error } = await supabase.rpc('list_jobs', type === 'All' ? {} : { p_type: type })
  if (error) fail(error)
  return data.map(toJob)
}

export async function listApplications(): Promise<ApplicationView[]> {
  const { data, error } = await supabase.rpc('list_my_applications')
  if (error) fail(error)
  return data.map((r) => ({
    job: toJob({ ...r, created_at: r.applied_at }),
    status: oneOf<ApplicationStatus>(['Applied', 'Shortlisted', 'Rejected'], r.status),
  }))
}

export async function applyToJob(jobId: string): Promise<void> {
  const { error } = await supabase.rpc('apply_to_job', { p_job_id: jobId })
  if (error) fail(error)
}

/* ---------------- Employer ---------------- */

export async function getEmployerAccount(): Promise<EmployerAccount> {
  const { data, error } = await supabase.rpc('get_my_employer')
  if (error) fail(error)
  const e = data[0]
  if (!e) throw new ApiError('FORBIDDEN', MESSAGES.FORBIDDEN)
  return {
    id: e.id, companyName: e.company_name, status: oneOf<EmployerStatus>(['Pending', 'Approved', 'Blocked'], e.status),
    freeUnlocksLeft: e.free_unlocks_left, spentInr: e.spent_inr, unlockedCount: e.unlocked_count,
  }
}

// One page of candidates. Pass the previous page's `next` to get the following page.
// Blocked and unfinished profiles are never returned; phone numbers only for candidates this employer unlocked.
export async function listCandidates(f: CandidateFilters, cursor?: Cursor): Promise<Page<CandidateCardData>> {
  const { data, error } = await supabase.rpc('search_candidates', {
    p_type: f.type === 'All' ? undefined : f.type,
    p_min_exp: f.minExp,
    p_area: f.area === 'All' ? undefined : f.area,
    p_max_salary: f.maxSalary,
    p_shift: f.shift === 'All' ? undefined : f.shift,
    p_verified_only: f.verifiedOnly,
    p_query: f.query,
    p_limit: LIST_PAGE_SIZE,
    ...cursorArgs(cursor),
  })
  if (error) fail(error)
  return toPage(data, toCard)
}

export async function listUnlocked(cursor?: Cursor): Promise<Page<CandidateCardData>> {
  const { data, error } = await supabase.rpc('list_unlocked', { p_limit: LIST_PAGE_SIZE, ...cursorArgs(cursor) })
  if (error) fail(error)
  return toPage(data, toCard)
}

// SERVER RULE (database function unlock_candidate): approved employers only, one free unlock or a recorded charge,
// never charged twice for the same candidate. Safe to call again: it just returns the number.
export async function unlockCandidate(candidateId: string): Promise<UnlockResult> {
  const { data, error } = await supabase.rpc('unlock_candidate', { p_candidate_id: candidateId })
  if (error) fail(error)
  const r = data[0]
  if (!r) throw new ApiError('UNKNOWN', MESSAGES.UNKNOWN)
  return { phone: r.phone, freeUnlocksLeft: r.free_unlocks_left, spentInr: r.spent_inr, unlockedCount: r.unlocked_count }
}

/* ---------------- Admin (every call is refused by the database unless the caller is an admin) ---------------- */

const ADMIN_LIST_LIMIT = 500 // same number as the 501-row LIMIT in the admin_list_* SQL functions

function toAdminList<R, T>(rows: R[], map: (r: R) => T): AdminList<T> {
  return { items: rows.slice(0, ADMIN_LIST_LIMIT).map(map), truncated: rows.length > ADMIN_LIST_LIMIT }
}

export async function getAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('admin_stats')
  if (error) fail(error)
  const s = data[0]
  if (!s) throw new ApiError('UNKNOWN', MESSAGES.UNKNOWN)
  return {
    candidates: s.candidates_count, employers: s.employers_count, pendingEmployers: s.pending_employers_count,
    jobs: s.jobs_count, unlocks: s.unlocks_count, revenueInr: s.revenue_inr,
  }
}

export async function listEmployers(): Promise<AdminList<AdminEmployer>> {
  const { data, error } = await supabase.rpc('admin_list_employers')
  if (error) fail(error)
  return toAdminList(data, (e) => ({
    id: e.id, phone: e.phone, companyName: e.company_name, status: oneOf<EmployerStatus>(['Pending', 'Approved', 'Blocked'], e.status),
    freeUnlocksLeft: e.free_unlocks_left, spentInr: e.spent_inr,
  }))
}

export async function setEmployerStatus(id: string, status: EmployerStatus): Promise<void> {
  const { error } = await supabase.rpc('admin_set_employer_status', { p_id: id, p_status: status })
  if (error) fail(error)
}

export async function listCandidatesForAdmin(): Promise<AdminList<AdminCandidate>> {
  const { data, error } = await supabase.rpc('admin_list_candidates')
  if (error) fail(error)
  return toAdminList(data, (c) => ({ ...toProfile(c), phone: c.phone }))
}

export async function setCandidateFlag(id: string, flag: 'verified' | 'blocked', value: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_candidate_flag', { p_id: id, p_flag: flag, p_value: value })
  if (error) fail(error)
}

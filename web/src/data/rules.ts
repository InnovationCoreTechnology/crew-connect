import type { ApplicationStatus, ApplicationView, CandidateProfile, Employer, OverviewRange } from './types'

// Business rules in plain functions, so they are easy to find, test and change.
// IMPORTANT: these only decide what the SCREEN shows. The same rules are enforced again in the database
// (supabase/migrations/*), which is what actually protects the data. Keep both in step.

// A candidate is visible to employers and can apply only after the name is filled.
// Mirrors the generated column `candidates.visible` and apply_to_job() in the database.
export const isProfileComplete = (c: Pick<CandidateProfile, 'name'>): boolean => c.name.trim().length >= 2

// Explains why an employer cannot unlock numbers. Empty text = allowed.
export function unlockBlockReason(e: Pick<Employer, 'status'>): string {
  if (e.status === 'Pending') return 'Your company is waiting for admin approval. You can browse candidates, but you cannot unlock numbers yet.'
  if (e.status === 'Blocked') return 'Your account is blocked. Please contact support.'
  return ''
}

// "Profile strength" shown to the candidate (display only, nothing in the database depends on it).
// Weights: basic details 60 + admin-verified ID 40. Add steps here when new profile fields exist
// (languages, about-me, photo: see DEVELOPMENT_ROADMAP.md). O(1), no lists involved.
export interface StrengthStep { key: 'details' | 'id'; label: string; done: boolean }

export function profileStrength(c: Pick<CandidateProfile, 'name' | 'verified'>): { percent: number; steps: StrengthStep[] } {
  const steps: StrengthStep[] = [
    { key: 'details', label: 'Basic details added', done: isProfileComplete(c) },
    { key: 'id', label: 'ID verified (earns the trust badge)', done: c.verified },
  ]
  const percent = (steps[0].done ? 60 : 0) + (steps[1].done ? 40 : 0)
  return { percent, steps }
}

// What the candidate reads for an application. The database stores Applied / Shortlisted / Rejected; the screen says
// "In review" and "Not selected" because "Applied" does not tell the candidate what is happening and "Rejected" is harsh.
export const APPLICATION_LABEL: Record<ApplicationStatus, string> = { Applied: 'In review', Shortlisted: 'Shortlisted', Rejected: 'Not selected' }
export const APPLICATION_ORDER: readonly ApplicationStatus[] = ['Applied', 'Shortlisted', 'Rejected']

// One pass over the list (O(n)) for the summary tiles and filter chips.
export function countApplications(apps: readonly Pick<ApplicationView, 'status'>[]): Record<ApplicationStatus, number> {
  const counts: Record<ApplicationStatus, number> = { Applied: 0, Shortlisted: 0, Rejected: 0 }
  for (const a of apps) counts[a.status] += 1
  return counts
}

// Steps of the progress tracker. Interview and Hired cannot happen yet (no employer pipeline until roadmap 4.3),
// so they are always shown as "not reached". A rejected application has no tracker.
export interface TrackerStep { label: string; reached: boolean }
export function applicationSteps(status: Exclude<ApplicationStatus, 'Rejected'>): TrackerStep[] {
  return [
    { label: 'Applied', reached: true },
    { label: 'Shortlisted', reached: status === 'Shortlisted' },
    { label: 'Interview', reached: false },
    { label: 'Hired', reached: false },
  ]
}

// Periods offered on the admin Overview. Days start at midnight India time (IST = UTC+5:30, no daylight saving),
// as decided in roadmap D25. "To" is left open: nothing can be created in the future.
export type OverviewPreset = 'today' | '7d' | '30d' | 'all'
export const OVERVIEW_PRESETS: ReadonlyArray<{ key: OverviewPreset; label: string }> = [
  { key: 'today', label: 'Today' }, { key: '7d', label: 'Last 7 days' }, { key: '30d', label: 'Last 30 days' }, { key: 'all', label: 'All time' },
]
const IST_OFFSET_MS = 19_800_000
const DAY_MS = 86_400_000
const startOfIstDay = (ms: number): number => Math.floor((ms + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS

export function overviewRange(preset: OverviewPreset, now: number = Date.now()): OverviewRange {
  if (preset === 'all') return { from: null, to: null }
  const days = preset === 'today' ? 0 : preset === '7d' ? 6 : 29
  return { from: new Date(startOfIstDay(now) - days * DAY_MS).toISOString(), to: null }
}

import type { CandidateProfile, Employer } from './types'

// Business rules in plain functions, so they are easy to find, test and change.
// IMPORTANT: these only decide what the SCREEN shows. The same rules are enforced again in the database
// (supabase/migrations/*), which is what actually protects the data. Keep both in step.

// A candidate is visible to employers and can apply only after the name is filled.
// Mirrors the generated column `candidates.visible` and apply_to_job() in the database.
// TODO: also require area, salary etc. once you add a "profile strength" meter.
export const isProfileComplete = (c: Pick<CandidateProfile, 'name'>): boolean => c.name.trim().length >= 2

// Explains why an employer cannot unlock numbers. Empty text = allowed.
export function unlockBlockReason(e: Pick<Employer, 'status'>): string {
  if (e.status === 'Pending') return 'Your company is waiting for admin approval. You can browse candidates, but you cannot unlock numbers yet.'
  if (e.status === 'Blocked') return 'Your account is blocked. Please contact support.'
  return ''
}

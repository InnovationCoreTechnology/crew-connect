import type { CandidateProfile, Employer } from './types'

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

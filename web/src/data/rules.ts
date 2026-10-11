import type { CandidateProfile, Employer } from './types'

// Business rules in plain functions, so they are easy to find, test and change.

// A candidate is visible to employers and can apply only after the name is filled.
// TODO: also require area, salary etc. once you add a "profile strength" meter.
export const isProfileComplete = (c: CandidateProfile): boolean => c.name.trim().length >= 2

// Explains why an employer cannot unlock numbers. Empty text = allowed.
export function unlockBlockReason(e: Pick<Employer, 'status'>): string {
  if (e.status === 'Pending') return 'Your company is waiting for admin approval. You can browse candidates, but you cannot unlock numbers yet.'
  if (e.status === 'Blocked') return 'Your account is blocked. Please contact support.'
  return ''
}

export const maskPhone = (phone: string): string => `${phone.slice(0, 2)}XXXXX${phone.slice(7)}`

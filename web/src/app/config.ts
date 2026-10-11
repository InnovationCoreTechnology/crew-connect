// ONE place for names and business rules. Change them here, not inside components.

export const BRAND = {
  name: 'Crew Connect',
  icon: '👷',
} as const

// TODO: When you add new job types (Driver, Electrician...), add them here.
// Then use JOB_TYPES in the profile form, job form and employer filters.
export const JOB_TYPES = ['Security', 'Housekeeping'] as const
export type JobType = (typeof JOB_TYPES)[number]

// TODO: These numbers are only shown on screen for now.
// The real free-unlock count and price MUST be enforced on the server (Supabase), never in the browser.
export const PRICING = {
  freeUnlocksForNewEmployer: 3,
  pricePerUnlockInr: 30,
} as const

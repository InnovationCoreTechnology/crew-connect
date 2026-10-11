// ONE place for names and business rules. Change them here, not inside components.

export const BRAND = {
  name: 'Crew Connect',
  icon: '👷',
} as const

// TODO: When you add new job types (Driver, Electrician...), add them here AND in the database
// (CHECK constraints in supabase/migrations, until roadmap 4.6 moves them into tables).
// Then use JOB_TYPES in the profile form, job form and employer filters.
export const JOB_TYPES = ['Security', 'Housekeeping'] as const
export type JobType = (typeof JOB_TYPES)[number]

// DISPLAY ONLY. The server decides the real values: table `app_settings` in the database
// (free_unlocks_new_employer, price_per_unlock_inr). Keep these two numbers equal to it, or the screen will mislead.
export const PRICING = {
  freeUnlocksForNewEmployer: 3,
  pricePerUnlockInr: 30,
} as const

// TODO: When you add more cities, load AREAS from the database per city instead of this list.
export const AREAS = [
  'Whitefield', 'Koramangala', 'HSR Layout', 'Indiranagar',
  'Marathahalli', 'Electronic City', 'Jayanagar', 'Yelahanka',
] as const

export const SHIFTS = ['Day', 'Night', 'Any'] as const
export const AVAILABILITY = ['Immediate', '15 days', '30 days'] as const

// How many cards a list loads at a time ("Load more" fetches the next page). The server allows at most 50.
export const LIST_PAGE_SIZE = 24

export const formatInr = (amount: number): string => `₹${amount.toLocaleString('en-IN')}`

// 0 -> "Fresher", 1 -> "1 yr exp", 5 -> "5 yrs exp"
export const formatYears = (years: number): string => (years === 0 ? 'Fresher' : `${years} yr${years === 1 ? '' : 's'} exp`)

// "Today", "Yesterday", "5 days ago", "2 weeks ago", then the date. `now` is a parameter so the function stays testable.
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const days = Math.floor((now - then) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return new Date(then).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

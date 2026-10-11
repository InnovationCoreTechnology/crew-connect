export const formatInr = (amount: number): string => `₹${amount.toLocaleString('en-IN')}`

// 0 -> "Fresher", 1 -> "1 yr exp", 5 -> "5 yrs exp"
export const formatYears = (years: number): string => (years === 0 ? 'Fresher' : `${years} yr${years === 1 ? '' : 's'} exp`)

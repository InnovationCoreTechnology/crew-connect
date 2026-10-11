import type { CandidateFilters } from '../../data/types'

export const DEFAULT_FILTERS: CandidateFilters = {
  type: 'All', minExp: 0, area: 'All', maxSalary: 0, shift: 'All', verifiedOnly: false, query: '',
}

// Dropdown choices for the filters. Edit here to change what employers can pick.
export const EXPERIENCE_OPTIONS = [
  { value: '0', label: 'Any' }, { value: '1', label: '1+ years' }, { value: '3', label: '3+ years' }, { value: '5', label: '5+ years' },
]
export const SALARY_OPTIONS = [
  { value: '0', label: 'Any' }, { value: '15000', label: 'Up to ₹15,000' },
  { value: '20000', label: 'Up to ₹20,000' }, { value: '25000', label: 'Up to ₹25,000' },
]
export const SHIFT_OPTIONS = [
  { value: 'All', label: 'Any shift' }, { value: 'Day', label: 'Day' }, { value: 'Night', label: 'Night' },
]

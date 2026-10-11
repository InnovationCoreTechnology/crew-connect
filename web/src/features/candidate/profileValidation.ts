// Rules for the candidate profile form. Each returns an error message, or '' when fine.

export function validateName(value: string): string {
  const name = value.trim()
  if (!name) return 'Enter your full name.'
  if (name.length < 2) return 'Name is too short.'
  if (!/^[A-Za-z .'-]+$/.test(name)) return 'Use letters only in your name.'
  return ''
}

export function validateExperience(value: string): string {
  if (value === '') return 'Enter your experience in years (0 if you are a fresher).'
  const years = Number(value)
  if (!Number.isInteger(years) || years < 0 || years > 40) return 'Enter a number between 0 and 40.'
  return ''
}

export function validateSalary(value: string): string {
  if (!value) return 'Enter your expected salary per month.'
  const salary = Number(value)
  if (salary < 5000 || salary > 100000) return 'Enter a salary between ₹5,000 and ₹1,00,000.'
  return ''
}

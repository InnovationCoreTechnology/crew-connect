import type { SignupRole } from '../types'

const OPTIONS: { value: SignupRole; label: string }[] = [
  { value: 'candidate', label: 'I want a job' },
  { value: 'employer', label: 'I want to hire' },
]

export function RoleToggle({ value, onChange }: { value: SignupRole; onChange: (role: SignupRole) => void }) {
  return (
    <div className="seg" role="group" aria-label="What do you want to do?">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? 'on' : ''}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

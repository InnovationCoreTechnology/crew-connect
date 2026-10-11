import { useState } from 'react'

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
  autoComplete?: 'current-password' | 'new-password'
  onEnter?: () => void
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

// Password input with an eye button: press and HOLD to see the password, release to hide it.
// TODO (Optional): switch to tap-to-toggle if users find press-and-hold hard on phones.
export function PasswordField({
  id, label, value, onChange, error, placeholder, autoComplete, onEnter,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const show = () => setVisible(true)
  const hide = () => setVisible(false)

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pwf">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={error ? 'bad' : ''}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.() }}
        />
        <button
          type="button"
          className="eye"
          aria-label="Hold to show password"
          onPointerDown={show}
          onPointerUp={hide}
          onPointerLeave={hide}
          onPointerCancel={hide}
          onBlur={hide}
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); show() } }}
          onKeyUp={hide}
          onContextMenu={(e) => e.preventDefault()}
        >
          <EyeIcon />
        </button>
      </div>
      {error && <p className="ferr" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  )
}

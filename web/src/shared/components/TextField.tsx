interface TextFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
  maxLength?: number
  numeric?: boolean // true = only digits are allowed (phone, OTP)
  disabled?: boolean
  onEnter?: () => void
}

// A reusable input with a label and an error line. Use it in every form.
export function TextField({
  id, label, value, onChange, error, placeholder, maxLength, numeric, disabled, onEnter,
}: TextFieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        inputMode={numeric ? 'numeric' : undefined}
        autoComplete="off"
        className={error ? 'bad' : ''}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(numeric ? e.target.value.replace(/\D/g, '') : e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.() }}
      />
      {error && <p className="ferr" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  )
}

interface Option {
  value: string
  label: string
}

interface SelectFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly (string | Option)[] // plain text, or {value, label}
  error?: string
}

// A reusable dropdown with a label and an error line (same look as TextField).
export function SelectField({ id, label, value, onChange, options, error }: SelectFieldProps) {
  const items = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} className={error ? 'bad' : ''} onChange={(e) => onChange(e.target.value)}>
        {items.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="ferr" role="alert">{error}</p>}
    </div>
  )
}

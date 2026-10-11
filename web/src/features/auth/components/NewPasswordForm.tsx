import { useState } from 'react'
import { PasswordField } from '../../../shared/components/PasswordField'
import { AuthError } from '../services/types'
import { validateConfirm, validateNewPassword } from '../validators'

interface Errors { password?: string; confirm?: string; form?: string }

interface Props {
  phone: string // used only to refuse passwords that contain the mobile number
  idPrefix: string
  submitLabel: string // "Create account" / "Save password"
  onSubmit: (password: string) => Promise<unknown> // success moves the page on by itself (see PublicOnly in App.tsx)
}

// The last step of Register and Forgot password: choose a password and type it again.
export function NewPasswordForm({ phone, idPrefix, submitLabel, onSubmit }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)

  const clearError = (key: keyof Errors) => setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }))

  async function submit() {
    const passwordError = validateNewPassword(password, phone)
    const confirmError = validateConfirm(password, confirm)
    if (passwordError || confirmError) {
      setErrors({ password: passwordError || undefined, confirm: confirmError || undefined })
      return
    }
    setBusy(true)
    try {
      await onSubmit(password)
    } catch (err) {
      if (err instanceof AuthError && (err.code === 'WEAK_PASSWORD' || err.code === 'SAME_PASSWORD')) setErrors({ password: err.message })
      else setErrors({ form: err instanceof AuthError ? err.message : 'Something went wrong. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="muted">Mobile number +91 {phone} is verified.</p>
      <PasswordField
        id={`${idPrefix}-password`} label="Create password" placeholder="8+ characters with a letter and number"
        autoComplete="new-password" value={password} error={errors.password}
        onChange={(v) => { setPassword(v); clearError('password') }} onEnter={submit}
      />
      <PasswordField
        id={`${idPrefix}-confirm`} label="Confirm password" placeholder="Type it again"
        autoComplete="new-password" value={confirm} error={errors.confirm}
        onChange={(v) => { setConfirm(v); clearError('confirm') }} onEnter={submit}
      />
      {errors.form && <p className="ferr" role="alert">{errors.form}</p>}
      <button type="button" className="btn big full" disabled={busy} onClick={submit}>
        {busy ? 'Please wait…' : submitLabel}
      </button>
    </>
  )
}

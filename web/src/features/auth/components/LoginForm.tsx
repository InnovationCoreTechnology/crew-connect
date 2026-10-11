import { useState } from 'react'
import { PasswordField } from '../../../shared/components/PasswordField'
import { TextField } from '../../../shared/components/TextField'
import { AUTH_CONFIG } from '../config'
import { useAuth } from '../context/useAuth'
import { AuthError } from '../services/types'
import { validateLoginPassword, validatePhone } from '../validators'

interface Errors { phone?: string; password?: string; form?: string }

function toErrors(err: unknown): Errors {
  if (err instanceof AuthError) {
    if (err.code === 'NOT_REGISTERED') return { phone: 'This number is not registered. Tap Register below.' }
    if (err.code === 'WRONG_PASSWORD') return { password: 'Wrong password. Please try again.' }
  }
  return { form: 'Something went wrong. Please try again.' }
}

export function LoginForm({ onSwitchToRegister }: { onSwitchToRegister: () => void }) {
  const { login } = useAuth()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)

  const clearError = (key: keyof Errors) => setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }))

  async function submit() {
    const phoneError = validatePhone(phone)
    const passwordError = validateLoginPassword(password)
    if (phoneError || passwordError) {
      setErrors({ phone: phoneError || undefined, password: passwordError || undefined })
      return
    }
    setBusy(true)
    try {
      await login(phone, password)
      // Success: PublicOnly (see App.tsx) moves the user to their dashboard.
    } catch (err) {
      setErrors(toErrors(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h2>Welcome back</h2>
      <p className="muted sub">Log in with your mobile number and password.</p>
      <TextField
        id="login-phone" label="Mobile number" numeric placeholder="10-digit number"
        maxLength={AUTH_CONFIG.phoneLength} value={phone} error={errors.phone}
        onChange={(v) => { setPhone(v); clearError('phone') }} onEnter={submit}
      />
      <PasswordField
        id="login-password" label="Password" placeholder="Your password" autoComplete="current-password"
        value={password} error={errors.password}
        onChange={(v) => { setPassword(v); clearError('password') }} onEnter={submit}
      />
      {/* TODO (Forgot password): add a link here that starts the OTP flow and then asks for a new password. */}
      {errors.form && <p className="ferr" role="alert">{errors.form}</p>}
      <button type="button" className="btn big full" disabled={busy} onClick={submit}>
        {busy ? 'Please wait…' : 'Log in'}
      </button>
      <p className="alt">New here? <button type="button" className="linkb" onClick={onSwitchToRegister}>Register</button></p>
    </>
  )
}

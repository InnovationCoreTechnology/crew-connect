import { useState } from 'react'
import { PasswordField } from '../../../shared/components/PasswordField'
import { TextField } from '../../../shared/components/TextField'
import { useCountdown } from '../../../shared/hooks/useCountdown'
import { AUTH_CONFIG } from '../config'
import { useAuth } from '../context/useAuth'
import { authService } from '../services'
import { AuthError } from '../services/types'
import type { Role } from '../types'
import { validateConfirm, validateNewPassword, validateOtp, validatePhone } from '../validators'
import { RoleToggle } from './RoleToggle'

type Step = 'phone' | 'otp' | 'password'
interface Errors { phone?: string; otp?: string; password?: string; confirm?: string; form?: string }
const BUTTON_LABEL: Record<Step, string> = { phone: 'Send OTP', otp: 'Verify OTP', password: 'Create account' }
const ALREADY = 'This number is already registered. Tap Log in below.'

interface Props {
  role: Role
  onRoleChange: (role: Role) => void
  onSwitchToLogin: () => void
}

// Three steps in one card: 1) mobile number  2) OTP (only once)  3) create password.
// AuthPage remounts this component when the role is tapped, so every field starts empty.
export function RegisterForm({ role, onRoleChange, onSwitchToLogin }: Props) {
  const { register } = useAuth()
  const countdown = useCountdown(AUTH_CONFIG.resendSeconds)
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [tries, setTries] = useState(0)
  const [busy, setBusy] = useState(false)

  const clearError = (key: keyof Errors) => setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }))

  // Runs a server call with the busy flag and one common error message.
  async function run(task: () => Promise<void>) {
    setBusy(true)
    try {
      await task()
    } catch (err) {
      if (err instanceof AuthError && err.code === 'ALREADY_REGISTERED') setErrors({ phone: ALREADY })
      else setErrors({ form: 'Something went wrong. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  async function submitPhone() {
    const message = validatePhone(phone)
    if (message) { setErrors({ phone: message }); return }
    await run(async () => {
      if (await authService.isRegistered(phone)) { setErrors({ phone: ALREADY }); return }
      await authService.sendOtp(phone)
      setErrors({}); setOtp(''); setTries(0); setStep('otp'); countdown.start()
    })
  }

  async function submitOtp() {
    const message = validateOtp(otp)
    if (message) { setErrors({ otp: message }); return }
    await run(async () => {
      if (await authService.verifyOtp(phone, otp)) {
        countdown.stop(); setErrors({}); setStep('password')
        return
      }
      const used = tries + 1
      setTries(used)
      if (used >= AUTH_CONFIG.maxOtpTries) {
        countdown.stop(); setOtp(''); setStep('phone')
        setErrors({ phone: 'Too many wrong OTPs. Please request a new OTP.' })
        return
      }
      const left = AUTH_CONFIG.maxOtpTries - used
      setErrors({ otp: `Wrong OTP. ${left} attempt${left === 1 ? '' : 's'} left.` })
    })
  }

  async function submitPassword() {
    const passwordError = validateNewPassword(password, phone)
    const confirmError = validateConfirm(password, confirm)
    if (passwordError || confirmError) {
      setErrors({ password: passwordError || undefined, confirm: confirmError || undefined })
      return
    }
    // Success: PublicOnly (see App.tsx) moves the user to their dashboard.
    await run(async () => { await register({ phone, password, role }) })
  }

  const submit = () => (step === 'phone' ? submitPhone() : step === 'otp' ? submitOtp() : submitPassword())

  async function resend() {
    await run(async () => {
      await authService.sendOtp(phone)
      setTries(0); setErrors({}); countdown.start()
    })
  }

  function changeNumber() {
    countdown.stop(); setOtp(''); setErrors({}); setTries(0); setStep('phone')
  }

  return (
    <>
      <h2>Create your account</h2>
      <RoleToggle value={role} onChange={onRoleChange} />
      <TextField
        id="reg-phone" label="Mobile number" numeric placeholder="10-digit number"
        maxLength={AUTH_CONFIG.phoneLength} value={phone} error={errors.phone} disabled={step !== 'phone'}
        onChange={(v) => { setPhone(v); clearError('phone') }} onEnter={submit}
      />

      {step === 'otp' && (
        <>
          <TextField
            id="reg-otp" label={`OTP sent to +91 ${phone}`} numeric placeholder={`${AUTH_CONFIG.otpLength}-digit OTP`}
            maxLength={AUTH_CONFIG.otpLength} value={otp} error={errors.otp}
            onChange={(v) => { setOtp(v); clearError('otp') }} onEnter={submit}
          />
          {/* TODO (Remove before launch): delete this demo line when real SMS OTP is connected. */}
          <p className="muted">Demo OTP is {AUTH_CONFIG.demoOtp}</p>
          <p className="rs">
            {countdown.left > 0
              ? <span>Resend OTP in {countdown.left}s</span>
              : <button type="button" className="linkb" onClick={resend}>Resend OTP</button>}
            <button type="button" className="linkb" onClick={changeNumber}>Change number</button>
          </p>
        </>
      )}

      {step === 'password' && (
        <>
          <PasswordField
            id="reg-password" label="Create password" placeholder="6+ characters with a letter and number"
            autoComplete="new-password" value={password} error={errors.password}
            onChange={(v) => { setPassword(v); clearError('password') }} onEnter={submit}
          />
          <PasswordField
            id="reg-confirm" label="Confirm password" placeholder="Type it again"
            autoComplete="new-password" value={confirm} error={errors.confirm}
            onChange={(v) => { setConfirm(v); clearError('confirm') }} onEnter={submit}
          />
        </>
      )}

      {errors.form && <p className="ferr" role="alert">{errors.form}</p>}
      <button type="button" className="btn big full" disabled={busy} onClick={submit}>
        {busy ? 'Please wait…' : BUTTON_LABEL[step]}
      </button>
      <p className="alt">Already registered? <button type="button" className="linkb" onClick={onSwitchToLogin}>Log in</button></p>
    </>
  )
}

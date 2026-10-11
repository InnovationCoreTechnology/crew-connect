import { useState } from 'react'
import { TextField } from '../../../shared/components/TextField'
import { useCountdown } from '../../../shared/hooks/useCountdown'
import { AUTH_CONFIG } from '../config'
import { authService } from '../services'
import { AuthError } from '../services/types'
import type { AuthMode } from '../types'
import { validateOtp, validatePhone } from '../validators'

type Step = 'phone' | 'otp'
interface Errors { phone?: string; otp?: string; form?: string }

interface Props {
  mode: AuthMode
  idPrefix: string // keeps input ids unique when two forms exist
  verifyLabel: string // button text on the OTP step, e.g. "Log in"
  onVerify: (phone: string, otp: string) => Promise<unknown> // checks the OTP and signs in / registers
  disabled?: boolean
}

// The shared "mobile number -> OTP" steps used by both Login and Register (login is OTP-only, no passwords).
// It sends the SMS, runs the resend timer, counts wrong tries and shows friendly errors.
// The caller decides what happens after the OTP is right (onVerify). Success moves the user away (see PublicOnly in App.tsx).
export function PhoneOtpForm({ mode, idPrefix, verifyLabel, onVerify, disabled }: Props) {
  const countdown = useCountdown(AUTH_CONFIG.resendSeconds)
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [tries, setTries] = useState(0)
  const [busy, setBusy] = useState(false)

  const clearError = (key: keyof Errors) => setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }))

  function backToPhone(message?: string) {
    countdown.stop(); setOtp(''); setTries(0); setStep('phone')
    setErrors(message ? { phone: message } : {})
  }

  async function submitPhone() {
    const message = validatePhone(phone)
    if (message) { setErrors({ phone: message }); return }
    setBusy(true)
    try {
      await authService.sendOtp(phone, mode)
      setErrors({}); setOtp(''); setTries(0); setStep('otp'); countdown.start()
    } catch (err) {
      if (err instanceof AuthError && err.code === 'NOT_REGISTERED') setErrors({ phone: 'This number is not registered. Tap Register below.' })
      else setErrors({ form: err instanceof AuthError ? err.message : 'Something went wrong. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  async function submitOtp() {
    const message = validateOtp(otp)
    if (message) { setErrors({ otp: message }); return }
    setBusy(true)
    try {
      await onVerify(phone, otp)
      // Success: the page moves on by itself.
    } catch (err) {
      if (!(err instanceof AuthError)) { setErrors({ form: 'Something went wrong. Please try again.' }); return }
      if (err.code === 'NOT_REGISTERED') { backToPhone('This number is not registered. Tap Register below.'); return }
      if (err.code === 'INVALID_OTP') {
        const used = tries + 1
        setTries(used)
        if (used >= AUTH_CONFIG.maxOtpTries) { backToPhone('Too many wrong OTPs. Please request a new OTP.'); return }
        const left = AUTH_CONFIG.maxOtpTries - used
        setErrors({ otp: `Wrong OTP. ${left} attempt${left === 1 ? '' : 's'} left.` })
        return
      }
      setErrors({ form: err.message }) // expired, rate limited, unknown
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setBusy(true)
    try {
      await authService.sendOtp(phone, mode)
      setTries(0); setErrors({}); countdown.start()
    } catch (err) {
      setErrors({ form: err instanceof AuthError ? err.message : 'Something went wrong. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  const submit = () => (step === 'phone' ? submitPhone() : submitOtp())

  return (
    <>
      <TextField
        id={`${idPrefix}-phone`} label="Mobile number" numeric placeholder="10-digit number"
        maxLength={AUTH_CONFIG.phoneLength} value={phone} error={errors.phone} disabled={step !== 'phone'}
        onChange={(v) => { setPhone(v); clearError('phone') }} onEnter={submit}
      />

      {step === 'otp' && (
        <>
          <TextField
            id={`${idPrefix}-otp`} label={`OTP sent to ${AUTH_CONFIG.countryCode} ${phone}`} numeric
            placeholder={`${AUTH_CONFIG.otpLength}-digit OTP`}
            maxLength={AUTH_CONFIG.otpLength} value={otp} error={errors.otp}
            onChange={(v) => { setOtp(v); clearError('otp') }} onEnter={submit}
          />
          <p className="rs">
            {countdown.left > 0
              ? <span>Resend OTP in {countdown.left}s</span>
              : <button type="button" className="linkb" disabled={busy} onClick={resend}>Resend OTP</button>}
            <button type="button" className="linkb" onClick={() => backToPhone()}>Change number</button>
          </p>
        </>
      )}

      {errors.form && <p className="ferr" role="alert">{errors.form}</p>}
      <button type="button" className="btn big full" disabled={busy || disabled} onClick={submit}>
        {busy ? 'Please wait…' : step === 'phone' ? 'Send OTP' : verifyLabel}
      </button>
    </>
  )
}

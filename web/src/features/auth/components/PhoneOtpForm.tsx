import { useRef, useState } from 'react'
import { TextField } from '../../../shared/components/TextField'
import { TurnstileWidget, type TurnstileHandle } from '../../../shared/components/TurnstileWidget'
import { useCountdown } from '../../../shared/hooks/useCountdown'
import { AUTH_CONFIG } from '../config'
import { useAuth } from '../context/useAuth'
import { authService } from '../services'
import { AuthError } from '../services/types'
import type { OtpPurpose } from '../types'
import { validateOtp, validatePhone } from '../validators'

type Step = 'phone' | 'otp'
interface Errors { phone?: string; otp?: string; form?: string }

interface Props {
  purpose: OtpPurpose // 'register' (new account) or 'reset' (forgot password)
  idPrefix: string // keeps input ids unique when two forms exist
  onVerified: (phone: string, otp: string) => void // the OTP was right: the parent keeps both and now asks for the password
}

// The shared "mobile number -> OTP" steps used by Register and Forgot password.
// It sends the SMS, runs the resend timer, counts wrong tries and shows friendly errors.
// What happens after the OTP is right is up to the parent (it shows the password step). The OTP is checked here without
// using it up; the server checks it again when the account is created / the password is changed.
// Asking for an OTP (Send / Resend) needs a CAPTCHA token (Cloudflare Turnstile) when a site key is configured. The check runs
// only when the user presses Send / Resend (never on its own), and every request gets a fresh one-time token.
// The SERVER verifies the token; this only collects it.
export function PhoneOtpForm({ purpose, idPrefix, onVerified }: Props) {
  const { checkOtp } = useAuth()
  const countdown = useCountdown(AUTH_CONFIG.resendSeconds)
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [tries, setTries] = useState(0)
  const [busy, setBusy] = useState(false)
  const captchaRef = useRef<TurnstileHandle>(null)
  const captchaRequired = AUTH_CONFIG.turnstileSiteKey !== ''

  // Runs the security check now and returns a one-time token (undefined when no CAPTCHA is configured).
  // Throws an AuthError CAPTCHA_FAILED when the check fails, is abandoned, or takes too long.
  async function getCaptchaToken(): Promise<string | undefined> {
    if (!captchaRequired) return undefined
    const failed = new AuthError('CAPTCHA_FAILED', 'The security check did not finish. Please try again.')
    const widget = captchaRef.current
    if (!widget) throw failed
    try {
      return await widget.getToken()
    } catch {
      throw failed
    }
  }

  const clearError = (key: keyof Errors) => setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }))

  function backToPhone(message?: string) {
    countdown.stop(); setOtp(''); setTries(0); setStep('phone')
    setErrors(message ? { phone: message } : {})
  }

  const notRegistered = 'This number is not registered. Tap Register below.'
  const alreadyRegistered = 'This number is already registered. Tap Log in below.'

  async function submitPhone() {
    const message = validatePhone(phone)
    if (message) { setErrors({ phone: message }); return }
    setBusy(true)
    try {
      await authService.sendOtp(phone, purpose, await getCaptchaToken())
      setErrors({}); setOtp(''); setTries(0); setStep('otp'); countdown.start()
    } catch (err) {
      if (err instanceof AuthError && err.code === 'NOT_REGISTERED') setErrors({ phone: notRegistered })
      else if (err instanceof AuthError && err.code === 'ALREADY_REGISTERED') setErrors({ phone: alreadyRegistered })
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
      await checkOtp(phone, otp, purpose)
      countdown.stop()
      onVerified(phone, otp)
    } catch (err) {
      if (!(err instanceof AuthError)) { setErrors({ form: 'Something went wrong. Please try again.' }); return }
      if (err.code === 'NOT_REGISTERED') { backToPhone(notRegistered); return }
      if (err.code === 'ALREADY_REGISTERED') { backToPhone(alreadyRegistered); return }
      if (err.code === 'OTP_EXPIRED' || err.code === 'TOO_MANY_ATTEMPTS') { setErrors({ form: err.message }); return } // use Resend OTP
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
      await authService.sendOtp(phone, purpose, await getCaptchaToken())
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

      {captchaRequired && <TurnstileWidget siteKey={AUTH_CONFIG.turnstileSiteKey} ref={captchaRef} />}
      {errors.form && <p className="ferr" role="alert">{errors.form}</p>}
      <button type="button" className="btn big full" disabled={busy} onClick={submit}>
        {busy ? 'Please wait…' : step === 'phone' ? 'Send OTP' : 'Verify OTP'}
      </button>
    </>
  )
}

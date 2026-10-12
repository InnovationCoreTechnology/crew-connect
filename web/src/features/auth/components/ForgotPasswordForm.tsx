import { useState } from 'react'
import { useAuth } from '../context/useAuth'
import { NewPasswordForm } from './NewPasswordForm'
import { PhoneOtpForm } from './PhoneOtpForm'

// Forgot password: verify the mobile number with an OTP, then choose a new password.
// The server checks the OTP again when the password is saved, then logs the person in with the new password.
export function ForgotPasswordForm({ onBackToLogin }: { onBackToLogin: () => void }) {
  const { resetPassword } = useAuth()
  const [verified, setVerified] = useState<{ phone: string; otp: string } | null>(null)

  return (
    <>
      <h2>Reset your password</h2>
      <p className="muted sub">
        {verified ? 'Choose a new password.' : 'Enter your mobile number. We will send an OTP to confirm it is you.'}
      </p>
      {verified ? (
        <NewPasswordForm
          phone={verified.phone} idPrefix="reset" submitLabel="Save password"
          onSubmit={(password) => resetPassword(verified.phone, verified.otp, password)}
        />
      ) : (
        <PhoneOtpForm purpose="reset" idPrefix="reset" onVerified={(phone, otp) => setVerified({ phone, otp })} />
      )}
      <p className="alt">Remembered it? <button type="button" className="linkb" onClick={onBackToLogin}>Log in</button></p>
    </>
  )
}

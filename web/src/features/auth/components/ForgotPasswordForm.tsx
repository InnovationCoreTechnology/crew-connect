import { useState } from 'react'
import { useAuth } from '../context/useAuth'
import { NewPasswordForm } from './NewPasswordForm'
import { PhoneOtpForm } from './PhoneOtpForm'

// Forgot password: verify the mobile number with an OTP, then choose a new password.
// Proving ownership of the number by OTP is what allows the new password (Supabase signs the person in on a correct OTP).
export function ForgotPasswordForm({ onBackToLogin }: { onBackToLogin: () => void }) {
  const { verifyOtp, completeReset } = useAuth()
  const [verifiedPhone, setVerifiedPhone] = useState('')

  return (
    <>
      <h2>Reset your password</h2>
      <p className="muted sub">
        {verifiedPhone ? 'Choose a new password.' : 'Enter your mobile number. We will send an OTP to confirm it is you.'}
      </p>
      {verifiedPhone ? (
        <NewPasswordForm phone={verifiedPhone} idPrefix="reset" submitLabel="Save password" onSubmit={completeReset} />
      ) : (
        <PhoneOtpForm
          purpose="reset" idPrefix="reset"
          onVerify={(phone, otp) => verifyOtp(phone, otp, 'reset')} onVerified={setVerifiedPhone}
        />
      )}
      <p className="alt">Remembered it? <button type="button" className="linkb" onClick={onBackToLogin}>Log in</button></p>
    </>
  )
}

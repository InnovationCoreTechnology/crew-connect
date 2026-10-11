import { useState } from 'react'
import { useAuth } from '../context/useAuth'
import type { SignupRole } from '../types'
import { NewPasswordForm } from './NewPasswordForm'
import { PhoneOtpForm } from './PhoneOtpForm'
import { RoleToggle } from './RoleToggle'

interface Props {
  role: SignupRole
  onRoleChange: (role: SignupRole) => void
  onSwitchToLogin: () => void
}

// New users: choose a role, verify the mobile number with an OTP, then create a password.
// AuthPage remounts this component when the role is tapped, so every field starts empty.
// The account (and its role) is created on the server after the password is saved.
export function RegisterForm({ role, onRoleChange, onSwitchToLogin }: Props) {
  const { verifyOtp, completeRegistration } = useAuth()
  const [verifiedPhone, setVerifiedPhone] = useState('') // set once the OTP is right -> shows the password step

  return (
    <>
      <h2>Create your account</h2>
      {!verifiedPhone && <RoleToggle value={role} onChange={onRoleChange} />}
      {verifiedPhone ? (
        <NewPasswordForm
          phone={verifiedPhone} idPrefix="reg" submitLabel="Create account"
          onSubmit={(password) => completeRegistration(password, role)}
        />
      ) : (
        <PhoneOtpForm
          purpose="register" idPrefix="reg"
          onVerify={(phone, otp) => verifyOtp(phone, otp, 'register')} onVerified={setVerifiedPhone}
        />
      )}
      <p className="alt">Already registered? <button type="button" className="linkb" onClick={onSwitchToLogin}>Log in</button></p>
    </>
  )
}

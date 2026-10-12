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
// The account (and its role) is created on the server after the password is chosen; the server checks the OTP again.
export function RegisterForm({ role, onRoleChange, onSwitchToLogin }: Props) {
  const { register } = useAuth()
  const [verified, setVerified] = useState<{ phone: string; otp: string } | null>(null) // set once the OTP is right -> shows the password step

  return (
    <>
      <h2>Create your account</h2>
      {!verified && <RoleToggle value={role} onChange={onRoleChange} />}
      {verified ? (
        <NewPasswordForm
          phone={verified.phone} idPrefix="reg" submitLabel="Create account"
          onSubmit={(password) => register(verified.phone, verified.otp, password, role)}
        />
      ) : (
        <PhoneOtpForm purpose="register" idPrefix="reg" onVerified={(phone, otp) => setVerified({ phone, otp })} />
      )}
      <p className="alt">Already registered? <button type="button" className="linkb" onClick={onSwitchToLogin}>Log in</button></p>
    </>
  )
}

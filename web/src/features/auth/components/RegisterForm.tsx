import { useAuth } from '../context/useAuth'
import type { SignupRole } from '../types'
import { PhoneOtpForm } from './PhoneOtpForm'
import { RoleToggle } from './RoleToggle'

interface Props {
  role: SignupRole
  onRoleChange: (role: SignupRole) => void
  onSwitchToLogin: () => void
}

// Choose a role, then the same mobile-number + OTP steps as login. There is no password (decision D4).
// AuthPage remounts this component when the role is tapped, so every field starts empty.
// The account (and its role) is created on the server after the OTP is verified.
export function RegisterForm({ role, onRoleChange, onSwitchToLogin }: Props) {
  const { signUp } = useAuth()

  return (
    <>
      <h2>Create your account</h2>
      <RoleToggle value={role} onChange={onRoleChange} />
      <PhoneOtpForm
        mode="register" idPrefix="reg" verifyLabel="Create account"
        onVerify={(phone, otp) => signUp(phone, otp, role)}
      />
      <p className="alt">Already registered? <button type="button" className="linkb" onClick={onSwitchToLogin}>Log in</button></p>
    </>
  )
}

import { useAuth } from '../context/useAuth'
import { PhoneOtpForm } from './PhoneOtpForm'

export function LoginForm({ onSwitchToRegister }: { onSwitchToRegister: () => void }) {
  const { signIn } = useAuth()

  return (
    <>
      <h2>Welcome back</h2>
      <p className="muted sub">Enter your mobile number. We will send you an OTP to log in.</p>
      <PhoneOtpForm mode="login" idPrefix="login" verifyLabel="Log in" onVerify={signIn} />
      <p className="alt">New here? <button type="button" className="linkb" onClick={onSwitchToRegister}>Register</button></p>
    </>
  )
}

import { useState } from 'react'
import { AuthLayout } from './components/AuthLayout'
import { ForgotPasswordForm } from './components/ForgotPasswordForm'
import { LoginForm } from './components/LoginForm'
import { RegisterForm } from './components/RegisterForm'
import { getAuthCopy } from './copy'
import type { AuthMode, SignupRole } from './types'

// The login page. It only decides: show LoginForm, RegisterForm or ForgotPasswordForm, and which role is chosen.
export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [role, setRole] = useState<SignupRole>('candidate')
  const [resetKey, setResetKey] = useState(0)
  const copy = getAuthCopy(mode, role)

  // Changing the key makes React rebuild the form, so all fields go back to their default state.
  function changeRole(next: SignupRole) {
    setRole(next)
    setResetKey((k) => k + 1)
  }

  return (
    <AuthLayout title={copy.title} points={copy.points}>
      {mode === 'login' && <LoginForm onSwitchToRegister={() => setMode('register')} onForgotPassword={() => setMode('forgot')} />}
      {mode === 'register' && (
        <RegisterForm key={resetKey} role={role} onRoleChange={changeRole} onSwitchToLogin={() => setMode('login')} />
      )}
      {mode === 'forgot' && <ForgotPasswordForm onBackToLogin={() => setMode('login')} />}
    </AuthLayout>
  )
}

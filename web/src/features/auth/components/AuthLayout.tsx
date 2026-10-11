import type { ReactNode } from 'react'
import { BRAND } from '../../../app/config'
import '../auth.css'

interface AuthLayoutProps {
  title: string
  points: string[]
  children: ReactNode
}

// The background, the left text and the white card. The forms go inside the card.
export function AuthLayout({ title, points, children }: AuthLayoutProps) {
  return (
    <div className="login">
      <span className="deco d1" aria-hidden="true">🛡️</span>
      <span className="deco d2" aria-hidden="true">🧹</span>
      <div className="lw">
        <div className="intro">
          <div className="logo">{BRAND.icon} {BRAND.name}</div>
          <h1>{title}</h1>
          <ul className="pts">{points.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
        <div className="card lc">{children}</div>
      </div>
    </div>
  )
}

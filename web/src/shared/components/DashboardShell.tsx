import type { ReactNode } from 'react'
import { BRAND } from '../../app/config'
import './dashboard.css'

interface DashboardShellProps {
  title: string
  subtitle?: string
  onLogout: () => void
  children: ReactNode
}

// The common top bar + page area used by every dashboard (candidate, employer, admin later).
export function DashboardShell({ title, subtitle, onLogout, children }: DashboardShellProps) {
  return (
    <>
      <header className="top">
        <div className="brand">{BRAND.icon} {BRAND.name}</div>
        <div className="who">
          {subtitle && <span className="muted">{subtitle}</span>}
          <button type="button" className="btn ghost sm" onClick={onLogout}>Log out</button>
        </div>
      </header>
      <main className="wrap">
        <h1 className="page-title">{title}</h1>
        {children}
      </main>
    </>
  )
}

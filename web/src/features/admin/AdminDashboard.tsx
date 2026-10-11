import { useState } from 'react'
import { getAdminStats } from '../../data/api'
import { DashboardShell } from '../../shared/components/DashboardShell'
import { StatsRow } from '../../shared/components/StatsRow'
import { Tabs } from '../../shared/components/Tabs'
import { formatInr } from '../../shared/format'
import { useResource } from '../../shared/hooks/useResource'
import { useAuth } from '../auth/context/useAuth'
import { CandidatesTable } from './CandidatesTable'
import { EmployersTable } from './EmployersTable'

// Admin screen. Admins cannot register: the owner creates them with supabase/admin/create_admin.sql.
// TODO (Jobs): add a tab to review and remove fake or spam jobs.
// TODO (Reports): users, jobs, applications and revenue over time (charts).
// TODO (ID check): open the candidate's uploaded ID photo before pressing Verify.
export function AdminDashboard() {
  const { logout } = useAuth()
  const [tab, setTab] = useState('employers')
  const stats = useResource(getAdminStats)
  const s = stats.data

  return (
    <DashboardShell title="Admin dashboard" subtitle="Admin" onLogout={logout}>
      {stats.error && <p className="ferr" role="alert">{stats.error}</p>}
      {s && (
        <StatsRow items={[
          { label: 'Candidates', value: s.candidates },
          { label: 'Employers', value: s.employers },
          { label: 'Pending approvals', value: s.pendingEmployers },
          { label: 'Open jobs', value: s.jobs },
          { label: 'Numbers unlocked', value: s.unlocks },
          { label: 'Revenue (demo)', value: formatInr(s.revenueInr) },
        ]} />
      )}
      <Tabs items={[{ key: 'employers', label: 'Employers' }, { key: 'candidates', label: 'Candidates' }]} active={tab} onChange={setTab} />
      {tab === 'employers' && <EmployersTable onChanged={stats.reload} />}
      {tab === 'candidates' && <CandidatesTable onChanged={stats.reload} />}
    </DashboardShell>
  )
}

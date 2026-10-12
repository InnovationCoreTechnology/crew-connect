import { useState } from 'react'
import { DashboardShell } from '../../shared/components/DashboardShell'
import { Tabs } from '../../shared/components/Tabs'
import { useAuth } from '../auth/context/useAuth'
import { AdminOverview } from './AdminOverview'
import { CandidatesTable } from './CandidatesTable'
import { EmployersTable } from './EmployersTable'

// Admin screen. Admins cannot register: the owner creates them with supabase/admin/create_admin.sql.
// TODO (Jobs): add a tab to review and remove fake or spam jobs.
// TODO (Reports): trends over time (charts); Approvals, Users and Master data tabs: see docs/ADMIN_DASHBOARD.md.
// TODO (ID check): open the candidate's uploaded ID photo before pressing Verify.
export function AdminDashboard() {
  const { logout } = useAuth()
  const [tab, setTab] = useState('overview')

  return (
    <DashboardShell title="Admin dashboard" subtitle="Admin" onLogout={logout}>
      <Tabs
        items={[{ key: 'overview', label: 'Overview' }, { key: 'employers', label: 'Employers' }, { key: 'candidates', label: 'Candidates' }]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'overview' && <AdminOverview onReviewEmployers={() => setTab('employers')} />}
      {tab === 'employers' && <EmployersTable />}
      {tab === 'candidates' && <CandidatesTable />}
    </DashboardShell>
  )
}

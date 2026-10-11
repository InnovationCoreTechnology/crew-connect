import { DashboardShell } from '../../shared/components/DashboardShell'
import { useAuth } from '../auth/context/useAuth'

// PLACEHOLDER page. Build each TODO below as its own small component inside this folder
// (for example ProfileForm.tsx, JobList.tsx, ApplicationList.tsx), then show them here.
//
// TODO 1 (Profile): form with name, job type (use JOB_TYPES from app/config.ts), experience in years,
//   area, expected salary, shift (Day/Night/Any), availability. Validate like auth/validators.ts.
//   Save to the Supabase `candidates` table. Show "ID verified" status (read-only, set by admin).
// TODO 2 (Find jobs): list jobs from the `jobs` table with a filter by job type, area and salary.
//   Add an Apply button that creates a row in `applications`. Disable it after applying.
// TODO 3 (Applications): table of the jobs this candidate applied to with the status
//   (Applied / Shortlisted / Rejected). Add a short empty-state message.
// TODO 4 (Job alerts): push notification when a matching job is posted (Firebase Cloud Messaging).
// TODO 5 (Documents): optional resume / ID photo upload to Supabase Storage. Do NOT store Aadhaar numbers.
export function CandidateDashboard() {
  const { user, logout } = useAuth()
  return (
    <DashboardShell title="Candidate dashboard" subtitle={`+91 ${user?.phone ?? ''}`} onLogout={logout}>
      <div className="card">
        <h2>Welcome</h2>
        <p className="muted">This page is a placeholder. Open this file and follow the TODO list at the top.</p>
        <ul className="todo">
          <li>Profile</li>
          <li>Find jobs</li>
          <li>My applications</li>
        </ul>
      </div>
    </DashboardShell>
  )
}

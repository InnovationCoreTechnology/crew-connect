import { useCallback } from 'react'
import { listApplications } from '../../data/api'
import type { ApplicationStatus } from '../../data/types'
import { Badge } from '../../shared/components/Badge'
import { useResource } from '../../shared/hooks/useResource'

const TONE: Record<ApplicationStatus, 'ok' | 'warn' | 'bad'> = { Applied: 'warn', Shortlisted: 'ok', Rejected: 'bad' }

export function ApplicationsTab() {
  const loader = useCallback(() => listApplications(), [])
  const apps = useResource(loader)

  return (
    <div className="card scroll">
      <h2>My applications</h2>
      {!apps.data && apps.loading && <p className="muted">Loading…</p>}
      {apps.error && <p className="ferr" role="alert">{apps.error}</p>}
      {apps.data?.length === 0 && <div className="empty">You have not applied yet. Open Find jobs to start.</div>}
      {apps.data && apps.data.length > 0 && (
        <table className="rtable">
          <thead><tr><th>Job</th><th>Company</th><th>Status</th></tr></thead>
          <tbody>
            {apps.data.map((a) => (
              <tr key={a.job.id}>
                <td data-label="Job">{a.job.title}</td>
                <td data-label="Company">{a.job.companyName}</td>
                <td data-label="Status"><Badge tone={TONE[a.status]}>{a.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {/* TODO: let the employer change the status (Shortlist / Reject) and notify the candidate (push notification). */}
    </div>
  )
}

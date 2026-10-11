import { useCallback, useState } from 'react'
import { JOB_TYPES, type JobType } from '../../app/config'
import { listCandidatesForAdmin, setCandidateFlag } from '../../data/api'
import { isProfileComplete } from '../../data/rules'
import { Badge } from '../../shared/components/Badge'
import { formatYears } from '../../shared/format'
import { useResource } from '../../shared/hooks/useResource'

export function CandidatesTable({ onChanged }: { onChanged: () => void }) {
  const loader = useCallback(() => listCandidatesForAdmin(), [])
  const result = useResource(loader)
  const [type, setType] = useState<JobType | 'All'>('All')
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  async function toggle(id: string, flag: 'verified' | 'blocked', value: boolean) {
    setError('')
    setBusyId(id)
    try {
      await setCandidateFlag(id, flag, value)
      result.reload()
      onChanged()
    } catch {
      setError('Could not update. Please try again.')
    } finally {
      setBusyId('')
    }
  }

  const rows = (result.data?.items ?? []).filter((c) => type === 'All' || c.type === type)

  return (
    <div className="card scroll">
      <div className="row">
        <h2>Candidates</h2>
        {result.data && <span className="muted">{rows.length} shown</span>}
      </div>
      <div className="chips" role="group" aria-label="Job type">
        {(['All', ...JOB_TYPES] as const).map((t) => (
          <button key={t} type="button" className={type === t ? 'on' : ''} aria-pressed={type === t} onClick={() => setType(t)}>
            {t === 'All' ? 'All types' : t}
          </button>
        ))}
      </div>
      {error && <p className="ferr" role="alert">{error}</p>}
      {!result.data && result.loading && <p className="muted">Loading…</p>}
      {result.error && <p className="ferr" role="alert">{result.error}</p>}
      {result.data && (
        <table className="rtable">
          <thead><tr><th>Name</th><th>Mobile</th><th>Type</th><th>Area</th><th>Exp</th><th>ID check</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td data-label="Name">{isProfileComplete(c) ? c.name : <span className="muted">Profile not completed</span>}</td>
                <td data-label="Mobile">{c.phone}</td>
                <td data-label="Type">{c.type}</td>
                <td data-label="Area">{c.area}</td>
                <td data-label="Experience">{formatYears(c.exp)}</td>
                <td data-label="ID check"><Badge tone={c.verified ? 'ok' : 'warn'}>{c.verified ? 'Verified' : 'Not verified'}</Badge></td>
                <td data-label="Status"><Badge tone={c.blocked ? 'bad' : 'ok'}>{c.blocked ? 'Blocked' : 'Active'}</Badge></td>
                <td data-label="Action">
                  <div className="actions">
                    <button type="button" className="btn ghost sm" disabled={busyId === c.id} onClick={() => toggle(c.id, 'verified', !c.verified)}>
                      {c.verified ? 'Unverify' : 'Verify'}
                    </button>
                    <button type="button" className={`btn sm ${c.blocked ? 'ok' : 'bad'}`} disabled={busyId === c.id} onClick={() => toggle(c.id, 'blocked', !c.blocked)}>
                      {c.blocked ? 'Unblock' : 'Block'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {result.data && rows.length === 0 && <div className="empty">No candidates for this job type.</div>}
      {result.data?.truncated && <p className="muted">Showing the newest 500 candidates only.</p>}
    </div>
  )
}

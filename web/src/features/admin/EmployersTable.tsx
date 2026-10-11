import { useCallback, useState } from 'react'
import { listEmployers, setEmployerStatus } from '../../data/api'
import type { EmployerStatus } from '../../data/types'
import { Badge } from '../../shared/components/Badge'
import { formatInr } from '../../shared/format'
import { useResource } from '../../shared/hooks/useResource'

const TONE: Record<EmployerStatus, 'ok' | 'warn' | 'bad'> = { Approved: 'ok', Pending: 'warn', Blocked: 'bad' }

export function EmployersTable({ onChanged }: { onChanged: () => void }) {
  const loader = useCallback(() => listEmployers(), [])
  const result = useResource(loader)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  async function change(id: string, status: EmployerStatus) {
    setError('')
    setBusyId(id)
    try {
      await setEmployerStatus(id, status)
      result.reload()
      onChanged() // refresh the stat cards
    } catch {
      setError('Could not update. Please try again.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="card scroll">
      <h2>Employers</h2>
      {error && <p className="ferr" role="alert">{error}</p>}
      {!result.data && result.loading && <p className="muted">Loading…</p>}
      {result.error && <p className="ferr" role="alert">{result.error}</p>}
      {result.data && (
        <table className="rtable">
          <thead><tr><th>Company</th><th>Mobile</th><th>Status</th><th>Free unlocks</th><th>Spent</th><th>Action</th></tr></thead>
          <tbody>
            {result.data.items.map((e) => (
              <tr key={e.id}>
                <td data-label="Company">{e.companyName || 'Company name not added yet'}</td>
                <td data-label="Mobile">{e.phone}</td>
                <td data-label="Status"><Badge tone={TONE[e.status]}>{e.status}</Badge></td>
                <td data-label="Free unlocks">{e.freeUnlocksLeft}</td>
                <td data-label="Spent">{formatInr(e.spentInr)}</td>
                <td data-label="Action">
                  <div className="actions">
                    {e.status !== 'Approved' && (
                      <button type="button" className="btn ok sm" disabled={busyId === e.id} onClick={() => change(e.id, 'Approved')}>
                        {e.status === 'Blocked' ? 'Unblock' : 'Approve'}
                      </button>
                    )}
                    {e.status !== 'Blocked' && (
                      <button type="button" className="btn bad sm" disabled={busyId === e.id} onClick={() => change(e.id, 'Blocked')}>Block</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {result.data?.truncated && <p className="muted">Showing the newest 500 employers only.</p>}
    </div>
  )
}

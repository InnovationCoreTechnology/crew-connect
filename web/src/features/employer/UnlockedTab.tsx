import { useCallback } from 'react'
import { listUnlocked } from '../../data/api'
import { useResource } from '../../shared/hooks/useResource'
import { CandidateCard } from './CandidateCard'

export function UnlockedTab({ employerId }: { employerId: string }) {
  const loader = useCallback(() => listUnlocked(employerId), [employerId])
  const result = useResource(loader)

  return (
    <div className="grid">
      {!result.data && result.loading && <div className="empty">Loading…</div>}
      {result.error && <p className="ferr" role="alert">{result.error}</p>}
      {result.data?.length === 0 && <div className="empty">No unlocked candidates yet. Unlock a number in Find candidates.</div>}
      {result.data?.map((c) => (
        <CandidateCard key={c.id} candidate={c} freeLeft={0} canUnlock={false} busy={false} onUnlock={() => undefined} />
      ))}
    </div>
  )
}

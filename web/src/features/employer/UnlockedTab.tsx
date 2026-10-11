import { useCallback } from 'react'
import { listUnlocked } from '../../data/api'
import type { Cursor } from '../../data/types'
import { useLoadMore } from '../../shared/hooks/useLoadMore'
import { useResource } from '../../shared/hooks/useResource'
import { CandidateCard } from './CandidateCard'

const loadFirstPage = () => listUnlocked() // a stable function, so useResource loads once

export function UnlockedTab() {
  const result = useResource(loadFirstPage)
  const fetchMore = useCallback((cursor: Cursor) => listUnlocked(cursor), [])
  const list = useLoadMore(result.data, fetchMore)

  return (
    <>
      <div className="grid">
        {!result.data && result.loading && <div className="empty">Loading…</div>}
        {result.error && <p className="ferr" role="alert">{result.error}</p>}
        {result.data && list.items.length === 0 && <div className="empty">No unlocked candidates yet. Unlock a number in Find candidates.</div>}
        {list.items.map((c) => (
          <CandidateCard key={c.id} candidate={c} freeLeft={0} canUnlock={false} busy={false} onUnlock={() => undefined} />
        ))}
      </div>
      {list.error && <p className="ferr" role="alert">{list.error}</p>}
      {list.hasMore && (
        <button type="button" className="btn ghost full push" disabled={list.loadingMore} onClick={list.loadMore}>
          {list.loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </>
  )
}

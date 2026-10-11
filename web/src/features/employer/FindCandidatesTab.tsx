import { useCallback, useState } from 'react'
import { ApiError, listCandidates, unlockCandidate } from '../../data/api'
import type { CandidateFilters as Filters, Cursor, EmployerAccount } from '../../data/types'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { useLoadMore } from '../../shared/hooks/useLoadMore'
import { useResource } from '../../shared/hooks/useResource'
import { CandidateCard } from './CandidateCard'
import { CandidateFilters } from './CandidateFilters'
import { DEFAULT_FILTERS } from './filters'

interface Props {
  account: EmployerAccount
  canUnlock: boolean
  onAccountChange: (account: EmployerAccount) => void
}

export function FindCandidatesTab({ account, canUnlock, onAccountChange }: Props) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [phones, setPhones] = useState<Record<string, string>>({}) // numbers unlocked in this visit, shown without reloading
  const search = useDebouncedValue(filters) // wait until the user stops typing, then search once
  const loader = useCallback(() => listCandidates(search), [search])
  const result = useResource(loader)
  const fetchMore = useCallback((cursor: Cursor) => listCandidates(search, cursor), [search])
  const list = useLoadMore(result.data, fetchMore)

  async function unlock(candidateId: string) {
    setError('')
    setBusyId(candidateId)
    try {
      const unlocked = await unlockCandidate(candidateId)
      setPhones((p) => ({ ...p, [candidateId]: unlocked.phone })) // the card shows the number straight away
      onAccountChange({ // updates free unlocks / spent in the top cards
        ...account, freeUnlocksLeft: unlocked.freeUnlocksLeft, spentInr: unlocked.spentInr, unlockedCount: unlocked.unlockedCount,
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not unlock. Please try again.')
    } finally {
      setBusyId('')
    }
  }

  const count = list.items.length

  return (
    <>
      <CandidateFilters
        filters={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />
      <p className="muted count" role="status">
        {!result.data || result.loading || search !== filters
          ? 'Searching…'
          : `${count}${list.hasMore ? '+' : ''} candidate${count === 1 && !list.hasMore ? '' : 's'} found`}
      </p>
      {error && <p className="ferr" role="alert">{error}</p>}
      {result.error && <p className="ferr" role="alert">{result.error}</p>}
      <div className={result.loading ? 'grid stale' : 'grid'}>
        {result.data && count === 0 && <div className="empty">No candidates match. Try removing a filter.</div>}
        {list.items.map((c) => (
          <CandidateCard key={c.id} candidate={phones[c.id] ? { ...c, phone: phones[c.id] } : c}
            freeLeft={account.freeUnlocksLeft} canUnlock={canUnlock} busy={busyId === c.id} onUnlock={unlock} />
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

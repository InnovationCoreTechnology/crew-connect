import { useCallback, useState } from 'react'
import { ApiError, listCandidates, unlockCandidate } from '../../data/api'
import type { CandidateFilters as Filters, EmployerAccount } from '../../data/types'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
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
  const search = useDebouncedValue(filters) // wait until the user stops typing, then search once
  const loader = useCallback(() => listCandidates(account.id, search), [account.id, search])
  const result = useResource(loader)

  async function unlock(candidateId: string) {
    setError('')
    setBusyId(candidateId)
    try {
      const { account: updated } = await unlockCandidate(account.id, candidateId)
      onAccountChange(updated) // updates free unlocks / spent in the top cards
      result.reload() // reload so the phone number appears
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not unlock. Please try again.')
    } finally {
      setBusyId('')
    }
  }

  const count = result.data?.length

  return (
    <>
      <CandidateFilters
        filters={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />
      <p className="muted count" role="status">
        {count === undefined || result.loading || search !== filters ? 'Searching…' : `${count} candidate${count === 1 ? '' : 's'} found`}
      </p>
      {error && <p className="ferr" role="alert">{error}</p>}
      {result.error && <p className="ferr" role="alert">{result.error}</p>}
      <div className={result.loading ? 'grid stale' : 'grid'}>
        {result.data?.length === 0 && <div className="empty">No candidates match. Try removing a filter.</div>}
        {result.data?.map((c) => (
          <CandidateCard key={c.id} candidate={c} freeLeft={account.freeUnlocksLeft} canUnlock={canUnlock}
            busy={busyId === c.id} onUnlock={unlock} />
        ))}
      </div>
    </>
  )
}

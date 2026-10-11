import { useCallback, useState } from 'react'
import type { Page } from '../../data/types'

interface Extra<T> {
  base: Page<T> // the first page these extra rows belong to
  items: T[]
  next: Page<T>['next']
}

// "Load more" for a list that is loaded page by page (keyset paging, see data/api.ts).
//   first      - the first page, usually from useResource (null while it is loading)
//   fetchMore  - loads the page that starts at the given cursor
// Extra pages are tied to the exact first page they were loaded after. When the first page is replaced (new filters,
// reload) the old extra rows are ignored automatically, so a new search never shows leftovers from the old one.
export function useLoadMore<T>(first: Page<T> | null, fetchMore: (cursor: NonNullable<Page<T>['next']>) => Promise<Page<T>>) {
  const [more, setMore] = useState<Extra<T> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const extra = first && more?.base === first ? more : null
  const next = first ? (extra ? extra.next : first.next) : null
  const items = first ? [...first.items, ...(extra?.items ?? [])] : []

  const loadMore = useCallback(async () => {
    if (!first || !next || busy) return
    setBusy(true)
    setError('')
    try {
      const page = await fetchMore(next)
      setMore({ base: first, items: [...(extra?.items ?? []), ...page.items], next: page.next })
    } catch {
      setError('Could not load more. Please try again.')
    } finally {
      setBusy(false)
    }
  }, [first, next, busy, fetchMore, extra])

  return { items, hasMore: next !== null, loadMore, loadingMore: busy, error }
}

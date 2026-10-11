import { useCallback, useEffect, useRef, useState } from 'react'

interface Source {
  loader: () => Promise<unknown>
  tick: number
}

interface State<T> {
  data: T | null
  error: string
  source: Source | null // which load produced this data (used to know if it is out of date)
}

// Loads data and gives you { data, loading, error, reload, setData }.
// Wrap the loader in useCallback so it reloads ONLY when its inputs (like filters) change.
// While a new load runs, the OLD data stays on screen and `loading` is true, so lists do not flicker
// but the screen can still show "Searching…".
export function useResource<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<State<T>>({ data: null, error: '', source: null })
  const [tick, setTick] = useState(0)
  const latest = useRef<Source>({ loader, tick })

  useEffect(() => {
    const source = { loader, tick }
    latest.current = source
    let alive = true // ignore answers that arrive after the screen changed
    loader()
      .then((data) => { if (alive) setState({ data, error: '', source }) })
      .catch(() => { if (alive) setState((s) => ({ ...s, error: 'Could not load. Please try again.', source })) })
    return () => { alive = false }
  }, [loader, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  const setData = useCallback((data: T) => setState({ data, error: '', source: latest.current }), [])
  const loading = state.source?.loader !== loader || state.source.tick !== tick
  return { data: state.data, error: state.error, loading, reload, setData }
}

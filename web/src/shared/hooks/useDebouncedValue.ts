import { useEffect, useState } from 'react'

// Returns `value` only after it has stopped changing for `ms` milliseconds.
// Use it for search boxes so we do not call the server on every key press.
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

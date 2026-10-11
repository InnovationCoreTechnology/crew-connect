import { useCallback, useEffect, useState } from 'react'

// Counts down from `seconds` to 0. Used for the "Resend OTP in 30s" timer.
export function useCountdown(seconds: number) {
  const [left, setLeft] = useState(0)

  useEffect(() => {
    if (left <= 0) return
    const id = setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => clearTimeout(id)
  }, [left])

  const start = useCallback(() => setLeft(seconds), [seconds])
  const stop = useCallback(() => setLeft(0), [])
  return { left, start, stop }
}

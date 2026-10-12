import { useEffect, useRef, useState } from 'react'

// Cloudflare Turnstile ("I am not a robot" check) for single-page apps: explicit rendering.
// The browser gets a one-time token (valid 300 s, usable once); the SERVER must verify it
// (supabase/functions/account-auth/turnstile.ts). The widget alone protects nothing.
// Docs (official, checked 2026-10-12): https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/

interface TurnstileApi {
  render(container: HTMLElement, options: { sitekey: string; theme?: 'auto' | 'light' | 'dark'; callback: (token: string) => void; 'error-callback': () => void }): string
  remove(widgetId: string): void
}
const api = (): TurnstileApi | undefined => (window as unknown as { turnstile?: TurnstileApi }).turnstile

// Cloudflare requires the script to be fetched from this exact URL (no proxying or copying it into our bundle).
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let scriptPromise: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (api()) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const el = document.createElement('script')
      el.src = SCRIPT_URL
      el.async = true
      el.onload = () => resolve()
      el.onerror = () => { scriptPromise = null; el.remove(); reject(new Error('Turnstile script failed to load')) }
      document.head.appendChild(el)
    })
  }
  return scriptPromise
}

interface Props {
  siteKey: string
  onToken: (token: string | null) => void // null = no valid token right now (loading, failed, or just reset)
  resetKey: number // change it to get a fresh challenge: a token can only be used once
}

export function TurnstileWidget({ siteKey, onToken, resetKey }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let widgetId: string | undefined
    let cancelled = false
    onToken(null)
    loadScript()
      .then(() => {
        const turnstile = api()
        if (cancelled || !box.current || !turnstile) return
        setFailed(false)
        widgetId = turnstile.render(box.current, {
          sitekey: siteKey,
          theme: 'auto',
          callback: (token) => onToken(token),
          'error-callback': () => onToken(null),
        })
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => {
      cancelled = true
      if (widgetId) api()?.remove(widgetId)
    }
  }, [siteKey, resetKey, onToken])

  return (
    <div className="captcha">
      <div ref={box} />
      {failed && <p className="ferr" role="alert">The security check could not load. Check your internet connection and refresh the page.</p>}
    </div>
  )
}

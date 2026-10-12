import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'

// Cloudflare Turnstile, run ON DEMAND: nothing happens when the form appears. The check starts only when the caller asks for
// a token (the user ticked our "I'm not a robot" box, see HumanCheck), so switching tabs or an empty form never starts a challenge.
// The token is valid 300 s and usable ONCE, and the SERVER must verify it (supabase/functions/account-auth/turnstile.ts):
// the widget alone protects nothing. Cloudflare decides whether a visitor sees a checkbox or just "Success!".
// Docs (official, checked 2026-10-12):
//   https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
//   https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/  (execution = 'execute', appearance = 'interaction-only')

interface TurnstileApi {
  render(container: HTMLElement, options: {
    sitekey: string
    theme?: 'auto' | 'light' | 'dark'
    execution?: 'render' | 'execute'
    appearance?: 'always' | 'execute' | 'interaction-only'
    callback: (token: string) => void
    'error-callback': () => void
  }): string
  execute(container: HTMLElement | string): void
  reset(widgetId: string): void
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

// What the parent can do with the widget.
export interface TurnstileHandle {
  // Starts the check and resolves with a fresh one-time token. Rejects if the check fails, is abandoned or takes too long.
  getToken(): Promise<string>
}

const TOKEN_TIMEOUT_MS = 120_000 // enough for a visitor who has to tick a checkbox

interface Props {
  siteKey: string
  ref: Ref<TurnstileHandle>
}

interface Pending { resolve: (token: string) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }

export function TurnstileWidget({ siteKey, ref }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | undefined>(undefined)
  const pending = useRef<Pending | null>(null)
  const used = useRef(false) // a widget that already produced a token must be reset before it can run again
  const [failed, setFailed] = useState(false)

  const settle = (outcome: { token: string } | { error: Error }) => {
    const p = pending.current
    if (!p) return
    clearTimeout(p.timer)
    pending.current = null
    if ('token' in outcome) p.resolve(outcome.token)
    else p.reject(outcome.error)
  }

  useEffect(() => {
    let cancelled = false
    loadScript()
      .then(() => {
        const turnstile = api()
        if (cancelled || !box.current || !turnstile) return
        widgetId.current = turnstile.render(box.current, {
          sitekey: siteKey,
          theme: 'auto',
          execution: 'execute', // do NOT start by itself
          appearance: 'interaction-only', // visible only when Cloudflare really needs the visitor to do something
          callback: (token) => settle({ token }),
          'error-callback': () => settle({ error: new Error('Turnstile error') }),
        })
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => {
      cancelled = true
      settle({ error: new Error('Turnstile removed') })
      if (widgetId.current) api()?.remove(widgetId.current)
      widgetId.current = undefined
      used.current = false
    }
  }, [siteKey])

  useImperativeHandle(ref, () => ({
    getToken() {
      return new Promise<string>((resolve, reject) => {
        const turnstile = api()
        const id = widgetId.current
        if (!turnstile || !id || !box.current) { reject(new Error('Turnstile is not ready')); return }
        settle({ error: new Error('Superseded by a newer request') })
        const timer = setTimeout(() => settle({ error: new Error('Turnstile timed out') }), TOKEN_TIMEOUT_MS)
        pending.current = { resolve, reject, timer }
        if (used.current) turnstile.reset(id) // the previous token is spent: start from a clean widget
        used.current = true
        turnstile.execute(box.current)
      })
    },
  }), [])

  return (
    <div className="captcha">
      <div ref={box} />
      {failed && <p className="ferr" role="alert">The security check could not load. Check your internet connection and refresh the page.</p>}
    </div>
  )
}

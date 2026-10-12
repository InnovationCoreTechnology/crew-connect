import { useId, useRef, useState } from 'react'
import { TurnstileWidget, type TurnstileHandle } from './TurnstileWidget'

// The "I'm not a robot" box the user ticks. Nothing is checked until the box is ticked; the tick then runs Cloudflare Turnstile
// behind it ("Verifying..." -> ticked). If Cloudflare needs a real challenge it shows its own widget inside this box.
// The tick is only the user interface: the protection is the one-time token, which the SERVER verifies
// (supabase/functions/account-auth/turnstile.ts). A token works once and expires after 300 s, so the parent re-creates this
// component (change its `key`) after every use, which returns the box to "unticked".

type State = 'idle' | 'verifying' | 'done' | 'error'

interface Props {
  siteKey: string
  onToken: (token: string | null) => void // a fresh one-time token once ticked; null when unticked or failed
  disabled?: boolean
}

export function HumanCheck({ siteKey, onToken, disabled }: Props) {
  const id = useId()
  const widget = useRef<TurnstileHandle>(null)
  const [state, setState] = useState<State>('idle')

  async function toggle(checked: boolean) {
    if (!checked) { setState('idle'); onToken(null); return }
    setState('verifying')
    try {
      const token = await widget.current?.getToken()
      if (!token) throw new Error('no token')
      setState('done')
      onToken(token)
    } catch {
      setState('error')
      onToken(null)
    }
  }

  const text = {
    idle: "I'm not a robot",
    verifying: 'Verifying…',
    done: 'Verified',
    error: "We could not verify you. Tick the box to try again.",
  }[state]

  return (
    <div className={`human ${state}`}>
      <div className="human-row">
        <input
          id={id} type="checkbox" checked={state === 'done'} disabled={disabled || state === 'verifying'}
          onChange={(e) => { void toggle(e.target.checked) }}
        />
        <label htmlFor={id} role={state === 'error' ? 'alert' : undefined}>{text}</label>
      </div>
      <TurnstileWidget siteKey={siteKey} ref={widget} />
    </div>
  )
}

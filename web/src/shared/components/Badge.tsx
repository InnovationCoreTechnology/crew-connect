import type { ReactNode } from 'react'

type Tone = 'neutral' | 'ok' | 'warn' | 'bad'

// Small coloured label: Verified, Pending, Blocked...
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={tone === 'neutral' ? 'tag' : `tag ${tone}`}>{children}</span>
}

import { PRICING } from '../../app/config'
import type { CandidateCardData } from '../../data/types'
import { Badge } from '../../shared/components/Badge'
import { formatInr, formatYears } from '../../shared/format'

interface Props {
  candidate: CandidateCardData
  freeLeft: number
  canUnlock: boolean // false for Pending / Blocked employers
  busy: boolean
  onUnlock: (candidateId: string) => void
}

// One candidate. The phone number stays hidden until it is unlocked.
export function CandidateCard({ candidate: c, freeLeft, canUnlock, busy, onUnlock }: Props) {
  return (
    <div className="card item">
      <div className="row">
        <b>{c.name}</b>
        {c.verified && <Badge tone="ok">✔ Verified</Badge>}
      </div>
      <div className="row">
        <Badge>{c.type}</Badge>
        <span className="muted">{formatYears(c.exp)}</span>
      </div>
      <div className="meta">
        <span>📍 {c.area}</span>
        <span>💰 {formatInr(c.salary)}/month</span>
        <span>🕒 {c.shift} shift</span>
        <span>⏱ Can join: {c.avail}</span>
      </div>
      {c.phone ? (
        <a className="btn ok full push" href={`tel:${c.phone}`}>📞 Call {c.phone}</a>
      ) : (
        <>
          <p className="muted mask push">📞 {c.maskedPhone}</p>
          <button type="button" className="btn full" disabled={!canUnlock || busy} onClick={() => onUnlock(c.id)}>
            {busy ? 'Please wait…' : freeLeft > 0 ? 'Unlock number (free)' : `Unlock number – ${formatInr(PRICING.pricePerUnlockInr)}`}
          </button>
        </>
      )}
      {/* TODO (Refund): add a "Number not working" button that gives the unlock back as credit. */}
    </div>
  )
}

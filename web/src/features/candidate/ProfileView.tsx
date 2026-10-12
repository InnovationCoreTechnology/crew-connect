import { profileStrength } from '../../data/rules'
import type { CandidateProfile } from '../../data/types'
import { Badge } from '../../shared/components/Badge'

// Why: after saving, a candidate should see a finished profile (like job sites do), not the empty-looking form again.
// What: read-only card of the saved profile, a "profile strength" meter and an Edit button. Display only, no data is changed here.
// Used by: ProfileTab. Strength rules live in data/rules.ts (profileStrength).
const rupees = new Intl.NumberFormat('en-IN')

export function ProfileView({ profile, justSaved, onEdit }: { profile: CandidateProfile; justSaved: boolean; onEdit: () => void }) {
  const { percent, steps } = profileStrength(profile)
  const facts: Array<[string, string]> = [
    ['Experience', profile.exp === 1 ? '1 year' : `${profile.exp} years`],
    ['Expected salary', `₹${rupees.format(profile.salary)} / month`],
    ['Shift', profile.shift],
    ['Can join', profile.avail],
  ]

  return (
    <div className="card">
      <div className="pv-head">
        <div className="pv-avatar" aria-hidden="true">{profile.name.trim().charAt(0).toUpperCase()}</div>
        <div className="pv-id">
          <h2>{profile.name}</h2>
          <p className="muted">{profile.type} · {profile.area}, Bangalore</p>
          <p className="pv-badges">
            {profile.verified ? <Badge tone="ok">✔ ID verified</Badge> : <Badge tone="warn">ID not verified yet</Badge>}
            {!profile.blocked && <Badge tone="ok">Visible to employers</Badge>}
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={onEdit}>Edit profile</button>
      </div>
      {justSaved && <p className="saved" role="status">Profile saved ✔</p>}

      <dl className="pv-facts">
        {facts.map(([label, value]) => (
          <div key={label} className="pv-fact"><dt className="muted">{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>

      <div className="pv-strength">
        <div className="row"><b>Profile strength</b><span className="muted">{percent}%</span></div>
        <div className="pv-meter" role="progressbar" aria-label="Profile strength" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <ul className="pv-steps">
          {steps.map((s) => <li key={s.key} className={s.done ? 'done' : ''}><span aria-hidden="true">{s.done ? '✔' : '○'}</span> {s.label}</li>)}
        </ul>
      </div>
      <p className="muted">Employers see your name and job details. Your full phone number is shown to them only after they unlock it.</p>
    </div>
  )
}

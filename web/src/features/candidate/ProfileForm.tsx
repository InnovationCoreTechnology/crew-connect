import { useState } from 'react'
import { AREAS, AVAILABILITY, JOB_TYPES, SHIFTS, type JobType } from '../../app/config'
import { saveCandidateProfile } from '../../data/api'
import type { Availability, CandidateProfile, Shift } from '../../data/types'
import { Badge } from '../../shared/components/Badge'
import { SelectField } from '../../shared/components/SelectField'
import { TextField } from '../../shared/components/TextField'
import { validateExperience, validateName, validateSalary } from './profileValidation'

interface Errors { name?: string; exp?: string; salary?: string; form?: string }

// onCancel is given only when the candidate already has a saved profile (they came here with Edit profile).
export function ProfileForm({ profile, onSaved, onCancel }: { profile: CandidateProfile; onSaved: () => void; onCancel?: () => void }) {
  const [name, setName] = useState(profile.name)
  const [type, setType] = useState<JobType>(profile.type)
  const [exp, setExp] = useState(String(profile.exp))
  const [area, setArea] = useState(profile.area)
  const [salary, setSalary] = useState(String(profile.salary))
  const [shift, setShift] = useState<Shift>(profile.shift)
  const [avail, setAvail] = useState<Availability>(profile.avail)
  const [errors, setErrors] = useState<Errors>({})
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  // Any edit hides the "Saved" message and clears that field's error.
  const edit = (key?: keyof Errors) => { setSaved(false); if (key) setErrors((p) => ({ ...p, [key]: undefined, form: undefined })) }

  async function save() {
    const found: Errors = {
      name: validateName(name) || undefined,
      exp: validateExperience(exp) || undefined,
      salary: validateSalary(salary) || undefined,
    }
    if (found.name || found.exp || found.salary) { setErrors(found); return }
    setBusy(true)
    try {
      await saveCandidateProfile({ ...profile, name, type, exp: Number(exp), area, salary: Number(salary), shift, avail })
      setSaved(true)
      onSaved()
    } catch {
      setErrors({ form: 'Could not save. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>My profile</h2>
      <p className="muted">Employers search using these details. Keep them up to date.</p>
      <div className="form" style={{ marginTop: 8 }}>
        <TextField id="pf-name" label="Full name" placeholder="As on your ID" value={name} error={errors.name}
          onChange={(v) => { setName(v); edit('name') }} />
        <SelectField id="pf-type" label="Job type" value={type} options={JOB_TYPES}
          onChange={(v) => { setType(v as JobType); edit() }} />
        <TextField id="pf-exp" label="Experience (years)" numeric maxLength={2} value={exp} error={errors.exp}
          onChange={(v) => { setExp(v); edit('exp') }} />
        <SelectField id="pf-area" label="Area in Bangalore" value={area} options={AREAS}
          onChange={(v) => { setArea(v); edit() }} />
        <TextField id="pf-salary" label="Expected salary (₹ per month)" numeric maxLength={6} value={salary} error={errors.salary}
          onChange={(v) => { setSalary(v); edit('salary') }} />
        <SelectField id="pf-shift" label="Shift" value={shift} options={SHIFTS}
          onChange={(v) => { setShift(v as Shift); edit() }} />
        <SelectField id="pf-avail" label="Can join" value={avail} options={AVAILABILITY}
          onChange={(v) => { setAvail(v as Availability); edit() }} />
      </div>
      <p style={{ margin: '14px 0 0' }}>
        {profile.verified ? <Badge tone="ok">✔ ID verified</Badge> : <Badge tone="warn">ID not verified yet</Badge>}
      </p>
      {/* TODO (Verification): add resume / ID photo upload (Supabase Storage). Do NOT store Aadhaar numbers. */}
      {errors.form && <p className="ferr" role="alert">{errors.form}</p>}
      <div className="actions">
        <button type="button" className="btn big" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save profile'}</button>
        {onCancel && <button type="button" className="btn ghost big" disabled={busy} onClick={onCancel}>Cancel</button>}
      </div>
      {saved && <p className="saved" role="status">Profile saved ✔</p>}
    </div>
  )
}

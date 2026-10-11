import { useCallback, useState } from 'react'
import { JOB_TYPES, type JobType } from '../../app/config'
import { ApiError, applyToJob, listApplications, listJobs } from '../../data/api'
import { isProfileComplete } from '../../data/rules'
import type { CandidateProfile } from '../../data/types'
import { Badge } from '../../shared/components/Badge'
import { SelectField } from '../../shared/components/SelectField'
import { formatInr } from '../../shared/format'
import { useResource } from '../../shared/hooks/useResource'

const TYPE_OPTIONS = [{ value: 'All', label: 'All types' }, ...JOB_TYPES.map((t) => ({ value: t, label: t }))]

export function JobsTab({ profile, onGoToProfile }: { profile: CandidateProfile; onGoToProfile: () => void }) {
  const [type, setType] = useState<JobType | 'All'>(profile.type) // starts with the candidate's own job type
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const jobsLoader = useCallback(() => listJobs(type), [type])
  const appsLoader = useCallback(() => listApplications(), [])
  const jobs = useResource(jobsLoader)
  const apps = useResource(appsLoader)

  const appliedIds = new Set((apps.data ?? []).map((a) => a.job.id))
  const complete = isProfileComplete(profile)

  async function apply(jobId: string) {
    setError('')
    setBusyId(jobId)
    try {
      await applyToJob(jobId)
      apps.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not apply. Please try again.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <>
      <div className="card bar">
        <SelectField id="jobs-type" label="Show jobs for" value={type} options={TYPE_OPTIONS}
          onChange={(v) => setType(v as JobType | 'All')} />
      </div>
      {error && <p className="ferr" role="alert">{error}</p>}
      {jobs.error && <p className="ferr" role="alert">{jobs.error}</p>}
      <div className={jobs.loading ? 'grid stale' : 'grid'}>
        {!jobs.data && jobs.loading && <div className="empty">Loading jobs…</div>}
        {jobs.data?.length === 0 && <div className="empty">No jobs here yet. Try another job type.</div>}
        {jobs.data?.map((j) => (
          <div className="card item" key={j.id}>
            <div className="row"><b>{j.title}</b></div>
            <Badge>{j.type}</Badge>
            <div className="meta">
              <span>🏢 {j.companyName}</span>
              <span>📍 {j.area}</span>
              <span>💰 {formatInr(j.salary)}/month</span>
              <span>🕒 {j.shift} shift · {j.openings} opening{j.openings === 1 ? '' : 's'}</span>
            </div>
            {appliedIds.has(j.id) ? (
              <button type="button" className="btn ghost full push" disabled>Applied ✔</button>
            ) : complete ? (
              <button type="button" className="btn full push" disabled={busyId === j.id || profile.blocked} onClick={() => apply(j.id)}>
                {busyId === j.id ? 'Please wait…' : 'Apply now'}
              </button>
            ) : (
              <button type="button" className="btn ghost full push" onClick={onGoToProfile}>Complete profile to apply</button>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

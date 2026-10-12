import { useCallback, useState } from 'react'
import { listApplications } from '../../data/api'
import { APPLICATION_LABEL, APPLICATION_ORDER, applicationSteps, countApplications } from '../../data/rules'
import type { ApplicationStatus, ApplicationView } from '../../data/types'
import { Badge } from '../../shared/components/Badge'
import { formatInr, timeAgo } from '../../shared/format'
import { useResource } from '../../shared/hooks/useResource'

const TONE: Record<ApplicationStatus, 'ok' | 'warn' | 'bad'> = { Applied: 'warn', Shortlisted: 'ok', Rejected: 'bad' }

// "My applications": summary tiles, filter chips and one card per application with a progress tracker.
// The data layer only knows Applied / Shortlisted / Rejected (see data/rules.ts for the wording and the tracker steps).
export function ApplicationsTab({ onFindJobs }: { onFindJobs: () => void }) {
  const loader = useCallback(() => listApplications(), [])
  const apps = useResource(loader)
  const [filter, setFilter] = useState<ApplicationStatus | 'All'>('All')

  const all = apps.data ?? []
  const counts = countApplications(all)
  const shown = filter === 'All' ? all : all.filter((a) => a.status === filter)

  return (
    <div className="card">
      <h2>My applications</h2>
      {!apps.data && apps.loading && <p className="muted">Loading…</p>}
      {apps.error && <p className="ferr" role="alert">{apps.error}</p>}
      {apps.data && all.length === 0 && (
        <div className="empty">
          <b>Start your first application</b>
          <p>Jobs that match your profile are waiting in Find jobs.</p>
          <button type="button" className="btn" onClick={onFindJobs}>Find jobs</button>
        </div>
      )}
      {all.length > 0 && (
        <>
          <div className="stats">
            {APPLICATION_ORDER.map((s) => (
              <div key={s} className="stat card"><span className="muted">{APPLICATION_LABEL[s]}</span><b>{counts[s]}</b></div>
            ))}
          </div>
          <div className="chips" role="group" aria-label="Filter applications">
            <button type="button" className={filter === 'All' ? 'on' : ''} aria-pressed={filter === 'All'} onClick={() => setFilter('All')}>All ({all.length})</button>
            {APPLICATION_ORDER.map((s) => (
              <button key={s} type="button" className={filter === s ? 'on' : ''} aria-pressed={filter === s} onClick={() => setFilter(s)}>
                {APPLICATION_LABEL[s]} ({counts[s]})
              </button>
            ))}
          </div>
          {shown.length === 0 && <p className="muted">No applications in this group.</p>}
          <ul className="applist">
            {shown.map((a) => <ApplicationCard key={a.job.id} app={a} onFindJobs={onFindJobs} />)}
          </ul>
        </>
      )}
      {/* TODO (roadmap 4.3 / 4.4): employer pipeline (Interview, Hired) and a notification when the status changes. */}
    </div>
  )
}

function ApplicationCard({ app, onFindJobs }: { app: ApplicationView; onFindJobs: () => void }) {
  const { job, status } = app
  return (
    <li className="appcard">
      <div className="row">
        <div>
          <h3>{job.title}</h3>
          <p className="muted">{job.companyName}</p>
        </div>
        <Badge tone={TONE[status]}>{APPLICATION_LABEL[status]}</Badge>
      </div>
      <p className="facts">
        <span className="tag">{job.area}</span>
        <span className="tag">{formatInr(job.salary)} / month</span>
        <span className="tag">{job.shift === 'Any' ? 'Any shift' : `${job.shift} shift`}</span>
        <span className="tag">{job.openings} {job.openings === 1 ? 'opening' : 'openings'}</span>
        <span className="tag">Applied {timeAgo(app.appliedAt)}</span>
      </p>
      {status === 'Rejected' ? (
        <p className="muted">Not selected this time. <button type="button" className="linkbtn" onClick={onFindJobs}>Find similar jobs</button></p>
      ) : (
        <>
          <ol className="tracker" aria-label="Application progress">
            {applicationSteps(status).map((s) => (
              <li key={s.label} className={s.reached ? 'reached' : ''}>
                <span className="dot" aria-hidden="true" />
                <span>{s.label}<span className="sr-only">{s.reached ? ' (reached)' : ' (not reached)'}</span></span>
              </li>
            ))}
          </ol>
          {status === 'Shortlisted' && <p className="muted">The employer shortlisted you. They may contact you on your phone.</p>}
        </>
      )}
    </li>
  )
}

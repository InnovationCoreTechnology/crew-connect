import { useCallback, useMemo, useState } from 'react'
import { getAdminOverview } from '../../data/api'
import { OVERVIEW_PRESETS, overviewRange, type OverviewPreset } from '../../data/rules'
import { StatsRow, type Stat } from '../../shared/components/StatsRow'
import { formatInr } from '../../shared/format'
import { useResource } from '../../shared/hooks/useResource'

// Why: the admin wants the big picture (companies, candidates, jobs, applications, unlocks, money) for a chosen period.
// What: one server call (admin_overview) per period; the numbers are never added up in the browser.
// Tiles whose data does not exist yet say so, with the roadmap item that unlocks them, instead of showing a made-up number.
// Design: docs/ADMIN_DASHBOARD.md. Used by: AdminDashboard.
const NOT_CONNECTED = '—'

export function AdminOverview({ onReviewEmployers }: { onReviewEmployers: () => void }) {
  const [preset, setPreset] = useState<OverviewPreset>('30d')
  const range = useMemo(() => overviewRange(preset), [preset])
  const loader = useCallback(() => getAdminOverview(range), [range])
  const overview = useResource(loader)
  const o = overview.data
  const allTime = preset === 'all'
  const fresh = (count: number) => (allTime ? '' : `${count} new`)
  const join = (...parts: string[]) => parts.filter(Boolean).join(' · ')

  const tiles: Stat[] = o
    ? [
        { label: 'Companies', value: o.employers.total, note: join(fresh(o.employers.new), `${o.employers.approved} approved`, `${o.employers.pending} pending`) },
        { label: 'Candidates', value: o.candidates.total, note: join(fresh(o.candidates.new), `${o.candidates.withCompleteProfile} with a complete profile`) },
        { label: 'Jobs', value: o.jobs.total, note: fresh(o.jobs.new) },
        { label: 'Applications', value: o.applications.total, note: fresh(o.applications.new) },
        { label: 'Numbers unlocked', value: o.unlocks.total, note: fresh(o.unlocks.new) },
        { label: 'Revenue (demo credits)', value: formatInr(allTime ? o.revenueInr.total : o.revenueInr.period), note: allTime ? 'No real payments yet' : `All time ${formatInr(o.revenueInr.total)}` },
        { label: 'Visitors', value: NOT_CONNECTED, note: 'Not connected yet (roadmap 2.6)' },
        { label: 'SMS and service cost', value: NOT_CONNECTED, note: 'Not connected yet (roadmap 1.8)' },
        { label: 'Net (revenue minus cost)', value: NOT_CONNECTED, note: 'Needs real payments (Phase 3) and SMS cost' },
      ]
    : []

  return (
    <div>
      <div className="chips" role="group" aria-label="Period">
        {OVERVIEW_PRESETS.map((p) => (
          <button key={p.key} type="button" className={preset === p.key ? 'on' : ''} aria-pressed={preset === p.key} onClick={() => setPreset(p.key)}>{p.label}</button>
        ))}
      </div>
      {!o && overview.loading && <p className="center-note">Loading…</p>}
      {overview.error && <p className="ferr" role="alert">{overview.error}</p>}
      {o && o.employers.pending > 0 && (
        <div className="banner warn">
          {o.employers.pending} {o.employers.pending === 1 ? 'company is' : 'companies are'} waiting for approval.{' '}
          <button type="button" className="linkbtn" onClick={onReviewEmployers}>Review</button>
        </div>
      )}
      {o && <div className={overview.loading ? 'stale' : ''}><StatsRow items={tiles} /></div>}
    </div>
  )
}

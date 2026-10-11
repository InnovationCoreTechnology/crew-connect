import { AREAS, JOB_TYPES } from '../../app/config'
import type { CandidateFilters as Filters, Shift } from '../../data/types'
import { SelectField } from '../../shared/components/SelectField'
import { TextField } from '../../shared/components/TextField'
import { EXPERIENCE_OPTIONS, SALARY_OPTIONS, SHIFT_OPTIONS } from './filters'

interface Props {
  filters: Filters
  onChange: (patch: Partial<Filters>) => void
  onReset: () => void
}

// The filter panel. It only shows the filters and reports changes; it does not load data itself.
export function CandidateFilters({ filters, onChange, onReset }: Props) {
  return (
    <div className="card">
      <div className="row">
        <b>Filter candidates</b>
        <button type="button" className="btn ghost sm" onClick={onReset}>Reset</button>
      </div>
      <div className="chips" role="group" aria-label="Job type">
        {(['All', ...JOB_TYPES] as const).map((t) => (
          <button key={t} type="button" className={filters.type === t ? 'on' : ''} aria-pressed={filters.type === t}
            onClick={() => onChange({ type: t })}>
            {t === 'All' ? 'All types' : t}
          </button>
        ))}
      </div>
      <div className="filters">
        {/* TODO (Backend): wait ~300 ms after typing before searching (debounce) so the server is not called on every key. */}
        <TextField id="f-query" label="Search name" placeholder="e.g. Ravi" value={filters.query}
          onChange={(v) => onChange({ query: v })} />
        <SelectField id="f-exp" label="Experience" value={String(filters.minExp)} options={EXPERIENCE_OPTIONS}
          onChange={(v) => onChange({ minExp: Number(v) })} />
        <SelectField id="f-area" label="Area" value={filters.area}
          options={[{ value: 'All', label: 'All areas' }, ...AREAS.map((a) => ({ value: a, label: a }))]}
          onChange={(v) => onChange({ area: v })} />
        <SelectField id="f-salary" label="Max salary" value={String(filters.maxSalary)} options={SALARY_OPTIONS}
          onChange={(v) => onChange({ maxSalary: Number(v) })} />
        <SelectField id="f-shift" label="Shift" value={filters.shift} options={SHIFT_OPTIONS}
          onChange={(v) => onChange({ shift: v as Shift | 'All' })} />
        <label className="check">
          <input type="checkbox" checked={filters.verifiedOnly} onChange={(e) => onChange({ verifiedOnly: e.target.checked })} />
          Verified only
        </label>
      </div>
    </div>
  )
}

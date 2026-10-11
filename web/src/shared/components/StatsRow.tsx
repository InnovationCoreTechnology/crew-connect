export interface Stat {
  label: string
  value: string | number
  note?: string
}

export function StatsRow({ items }: { items: Stat[] }) {
  return (
    <div className="stats">
      {items.map((s) => (
        <div className="card stat" key={s.label}>
          <span className="muted">{s.label}</span>
          <b>{s.value}</b>
          {s.note && <span className="muted note">{s.note}</span>}
        </div>
      ))}
    </div>
  )
}

export interface TabItem {
  key: string
  label: string
}

export function Tabs({ items, active, onChange }: { items: TabItem[]; active: string; onChange: (key: string) => void }) {
  return (
    <nav className="tabs" role="tablist">
      {items.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          className={active === t.key ? 'on' : ''}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}

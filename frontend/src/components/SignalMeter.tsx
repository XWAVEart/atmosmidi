interface Props {
  label: string
  value: number | null | undefined
  unit?: string
  min?: number
  max?: number
  accent?: string
}

export function SignalMeter({
  label,
  value,
  unit = '',
  min = 0,
  max = 100,
  accent = 'var(--color-cyan)',
}: Props) {
  const v = value ?? 0
  const pct = Math.max(0, Math.min(100, ((v - min) / (max - min || 1)) * 100))

  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)]/70 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
          {label}
        </span>
        <span className="font-[family-name:var(--font-display)] text-lg text-white tabular-nums">
          {value == null ? '—' : value.toFixed(value >= 100 ? 0 : 1)}
          {unit && <span className="ml-1 text-xs text-[var(--color-muted)]">{unit}</span>}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full origin-left rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${accent}, var(--color-blue))`,
            boxShadow: `0 0 12px ${accent}55`,
          }}
        />
      </div>
    </div>
  )
}

import { cn } from '@/lib/cn'
import { fmtKcal, round1, type Macros } from '@/lib/macros'

const MACRO_META = [
  { key: 'protein', label: 'P', color: 'var(--color-protein)' },
  { key: 'carbs', label: 'C', color: 'var(--color-carbs)' },
  { key: 'fat', label: 'F', color: 'var(--color-fat)' },
] as const

/** compact "P 32 · C 40 · F 12" line */
export function MacroLine({ macros, className }: { macros: Macros; className?: string }) {
  return (
    <span className={cn('text-xs font-semibold text-ink-faint', className)}>
      {MACRO_META.map((m, i) => (
        <span key={m.key}>
          {i > 0 && ' · '}
          <span style={{ color: m.color }}>{m.label}</span> {round1(macros[m.key])}
        </span>
      ))}
    </span>
  )
}

/** a horizontal progress bar: value vs target */
export function MacroBar({
  label,
  value,
  target,
  color,
  unit = 'g',
}: {
  label: string
  value: number
  target: number
  color: string
  unit?: string
}) {
  const pct = target > 0 ? Math.min(1, value / target) : 0
  const over = target > 0 && value > target
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-xs font-semibold">
        <span className="text-ink-soft">{label}</span>
        <span className="text-ink-faint">
          <span className="text-ink">{round1(value)}</span> / {round1(target)}
          {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct * 100}%`, background: over ? 'var(--color-over)' : color }}
        />
      </div>
    </div>
  )
}

export function KcalText({ kcal }: { kcal: number }) {
  return <span className="tabular-nums">{fmtKcal(kcal)}</span>
}

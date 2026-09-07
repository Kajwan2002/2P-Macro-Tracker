import { cn } from '@/lib/cn'

export interface Bar {
  label: string
  value: number
  /** optional reference line (e.g. the target) drawn across the bar */
  target?: number
  highlight?: boolean
}

interface BarChartProps {
  bars: Bar[]
  height?: number
  formatValue?: (v: number) => string
  color?: string
}

export function BarChart({ bars, height = 130, formatValue, color = 'var(--color-accent)' }: BarChartProps) {
  const max = Math.max(1, ...bars.map((b) => Math.max(b.value, b.target ?? 0)))
  const peak = bars.reduce((p, b, i) => (b.value > bars[p].value ? i : p), 0)

  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {bars.map((b, i) => {
        const h = b.value > 0 ? Math.max(4, (b.value / max) * (height - 24)) : 3
        const targetH = b.target ? (b.target / max) * (height - 24) : 0
        return (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            {i === peak && formatValue && b.value > 0 && (
              <span className="text-[0.6rem] font-bold text-ink-soft">{formatValue(b.value)}</span>
            )}
            <div className="relative flex w-full flex-1 items-end">
              <div
                className="w-full rounded-md transition-all"
                style={{ height: h, background: b.value > 0 ? color : 'var(--color-surface-2)', opacity: b.highlight ? 1 : 0.65 }}
              />
              {targetH > 0 && (
                <div
                  className="absolute inset-x-0 border-t border-dashed border-ink-faint"
                  style={{ bottom: targetH }}
                />
              )}
            </div>
            <span
              className={cn(
                'text-[0.6rem] font-semibold',
                b.highlight ? 'text-ink' : 'text-ink-faint',
              )}
            >
              {b.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

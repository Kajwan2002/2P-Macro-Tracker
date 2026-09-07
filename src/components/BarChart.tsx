import { cn } from '@/lib/cn'

export interface Bar {
  label: string
  value: number
  /** optional reference line (e.g. the target) drawn across the track */
  target?: number
  highlight?: boolean
}

interface BarChartProps {
  bars: Bar[]
  height?: number
  formatValue?: (v: number) => string
  color?: string
  /** colour for highlighted bars (defaults to `color`) */
  highlightColor?: string
}

export function BarChart({
  bars,
  height = 130,
  formatValue,
  color = 'var(--color-accent)',
  highlightColor,
}: BarChartProps) {
  const max = Math.max(1, ...bars.map((b) => Math.max(b.value, b.target ?? 0)))
  const many = bars.length > 12
  const peak = bars.reduce((p, b, i) => (b.value > bars[p].value ? i : p), 0)

  return (
    <div className="w-full overflow-hidden">
      <div className="flex items-stretch" style={{ height, gap: many ? 2 : 5 }}>
        {bars.map((b, i) => {
          const hPct = b.value > 0 ? Math.max(3, (b.value / max) * 100) : 0
          const tPct = b.target ? Math.min(100, (b.target / max) * 100) : 0
          return (
            <div key={i} className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-1">
              {!many && i === peak && formatValue && b.value > 0 && (
                <span className="text-[0.6rem] font-bold text-ink-soft">{formatValue(b.value)}</span>
              )}
              <div className="relative w-full min-h-0 flex-1 overflow-hidden rounded-[3px] bg-surface-2">
                {hPct > 0 && (
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-[3px]"
                    style={{
                      height: `${hPct}%`,
                      background: b.highlight ? (highlightColor ?? color) : color,
                      opacity: b.highlight ? 1 : 0.6,
                    }}
                  />
                )}
                {tPct > 0 && (
                  <div
                    className="absolute inset-x-0 border-t border-dashed border-ink-faint"
                    style={{ bottom: `${tPct}%` }}
                  />
                )}
              </div>
              {!many && (
                <span
                  className={cn(
                    'text-[0.6rem] font-semibold',
                    b.highlight ? 'text-ink' : 'text-ink-faint',
                  )}
                >
                  {b.label}
                </span>
              )}
            </div>
          )
        })}
      </div>
      {many && (
        <div className="mt-1 flex justify-between text-[0.6rem] font-semibold text-ink-faint">
          <span>{bars[0]?.label}</span>
          <span>{bars[bars.length - 1]?.label}</span>
        </div>
      )}
    </div>
  )
}

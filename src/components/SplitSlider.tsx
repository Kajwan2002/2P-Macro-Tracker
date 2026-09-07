import type { ReactNode } from 'react'

interface SplitSliderProps {
  /** your percentage, 0..100 */
  value: number
  onChange: (pct: number) => void
  leftLabel: string
  rightLabel: string
  leftAccent?: string
  rightAccent?: string
  leftDetail?: ReactNode
  rightDetail?: ReactNode
}

export function SplitSlider({
  value,
  onChange,
  leftLabel,
  rightLabel,
  leftAccent = 'var(--color-accent)',
  rightAccent = 'var(--color-ink-faint)',
  leftDetail,
  rightDetail,
}: SplitSliderProps) {
  const you = Math.round(Math.max(0, Math.min(100, value)))
  const them = 100 - you

  return (
    <div className="rounded-2xl bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-3 text-sm">
        <div className="min-w-0">
          <div className="font-bold text-ink" style={{ color: leftAccent }}>
            {leftLabel} · {you}%
          </div>
          {leftDetail && <div className="mt-0.5 text-xs text-ink-faint">{leftDetail}</div>}
        </div>
        <div className="min-w-0 text-right">
          <div className="font-bold" style={{ color: rightAccent }}>
            {them}% · {rightLabel}
          </div>
          {rightDetail && <div className="mt-0.5 text-xs text-ink-faint">{rightDetail}</div>}
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={you}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(to right, ${leftAccent} ${you}%, var(--color-surface-2) ${you}%)`,
          accentColor: leftAccent,
        }}
        aria-label={`${leftLabel} share`}
      />

      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={() => onChange(50)}
          className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-ink-soft active:brightness-110"
        >
          Split 50 / 50
        </button>
      </div>
    </div>
  )
}

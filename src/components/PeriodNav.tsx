interface PeriodNavProps {
  label: string
  onPrev: () => void
  onNext: () => void
  nextDisabled?: boolean
}

export function PeriodNav({ label, onPrev, onNext, nextDisabled }: PeriodNavProps) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onPrev}
        className="grid h-9 w-9 place-items-center rounded-full bg-surface text-ink-soft shadow-card active:scale-95"
        aria-label="Previous day"
      >
        <Chevron dir="left" />
      </button>
      <span className="text-base font-extrabold tracking-tight text-ink">{label}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="grid h-9 w-9 place-items-center rounded-full bg-surface text-ink-soft shadow-card active:scale-95 disabled:opacity-30"
        aria-label="Next day"
      >
        <Chevron dir="right" />
      </button>
    </div>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

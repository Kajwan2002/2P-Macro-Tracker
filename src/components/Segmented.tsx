import { cn } from '@/lib/cn'

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div className={cn('flex rounded-full bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-full px-4 py-2 text-sm font-bold transition',
            value === o.value ? 'bg-accent text-bg-deep' : 'text-ink-soft',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

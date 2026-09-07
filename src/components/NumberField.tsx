import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

interface NumberFieldProps {
  label?: string
  value: number
  onChange: (value: number) => void
  suffix?: string
  placeholder?: string
  step?: number
  min?: number
  className?: string
  allowEmpty?: boolean
}

/** A numeric input that keeps its own text state so partial edits ("1.") work. */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  placeholder,
  min = 0,
  className,
}: NumberFieldProps) {
  const fmt = (n: number) => (n === 0 ? '' : String(n))
  const [text, setText] = useState(fmt(value))
  const editing = useRef(false)

  useEffect(() => {
    if (!editing.current) setText(fmt(value))
  }, [value])

  return (
    <label className={cn('flex flex-col gap-1', className)}>
      {label && <span className="text-[0.7rem] font-bold text-ink-soft">{label}</span>}
      <div className="flex items-center gap-1.5 rounded-2xl bg-surface-2 px-3 py-2.5">
        <input
          inputMode="decimal"
          placeholder={placeholder ?? '0'}
          value={text}
          onFocus={() => {
            editing.current = true
          }}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.')
            setText(v)
            const n = Number(v)
            onChange(Number.isFinite(n) ? Math.max(min, n) : min)
          }}
          onBlur={() => {
            editing.current = false
            setText(fmt(value))
          }}
          className="w-full min-w-0 bg-transparent font-bold text-ink outline-none placeholder:text-ink-faint"
        />
        {suffix && <span className="shrink-0 text-sm font-semibold text-ink-faint">{suffix}</span>}
      </div>
    </label>
  )
}

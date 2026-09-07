import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface RingProps {
  /** 0..1 (values above 1 render as a full ring in the "over" colour) */
  value: number
  size?: number
  stroke?: number
  color?: string
  trackColor?: string
  overColor?: string
  className?: string
  children?: ReactNode
}

export function Ring({
  value,
  size = 200,
  stroke = 16,
  color = 'var(--color-accent)',
  trackColor = 'var(--color-surface-2)',
  overColor = 'var(--color-over)',
  className,
  children,
}: RingProps) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const over = value > 1.0001
  const clamped = Math.max(0, Math.min(1, over ? 1 : value))
  const dash = circ * clamped

  return (
    <div
      className={cn('relative grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        {clamped > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={over ? overColor : color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            style={{ transition: 'stroke-dasharray 0.55s cubic-bezier(0.22,1,0.36,1), stroke 0.3s' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'soft' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-bg-deep shadow-soft active:brightness-95 disabled:opacity-40',
  soft: 'bg-surface-2 text-ink active:brightness-110 disabled:opacity-40',
  ghost: 'bg-transparent text-ink-soft active:bg-surface-2',
  danger: 'bg-over/15 text-over active:bg-over/25',
}

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: Variant
  full?: boolean
}

export function Button({
  variant = 'primary',
  full,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[0.95rem] font-bold transition select-none',
        'active:scale-[0.98] disabled:pointer-events-none',
        full && 'w-full',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}

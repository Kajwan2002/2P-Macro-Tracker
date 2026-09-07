import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('rounded-3xl bg-surface p-5 shadow-card', className)} {...props} />
}

export function SectionTitle({ className, ...props }: ComponentPropsWithoutRef<'h2'>) {
  return (
    <h2
      className={cn('px-1 text-[0.95rem] font-bold tracking-tight text-ink-soft', className)}
      {...props}
    />
  )
}

import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'

interface ScreenProps {
  title: ReactNode
  subtitle?: ReactNode
  back?: boolean | string
  right?: ReactNode
  children: ReactNode
  className?: string
}

export function Screen({ title, subtitle, back, right, children, className }: ScreenProps) {
  const navigate = useNavigate()
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-safe-nav">
      <header className="mb-4 flex items-center gap-3">
        {back && (
          <button
            type="button"
            onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            aria-label="Back"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface text-ink-soft shadow-card active:scale-95"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 6l-6 6 6 6"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="text-sm font-semibold text-ink-soft">{subtitle}</p>}
        </div>
        {right}
      </header>
      <main className={cn('flex flex-1 flex-col gap-4', className)}>{children}</main>
    </div>
  )
}

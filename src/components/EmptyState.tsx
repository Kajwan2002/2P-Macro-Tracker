import type { ReactNode } from 'react'

interface EmptyStateProps {
  emoji: string
  title: string
  hint?: string
  action?: ReactNode
}

export function EmptyState({ emoji, title, hint, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="text-4xl">{emoji}</div>
      <p className="font-bold text-ink">{title}</p>
      {hint && <p className="max-w-[16rem] text-sm text-ink-soft">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

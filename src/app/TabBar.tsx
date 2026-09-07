import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'

const tabs = [
  { to: '/', label: 'Today', icon: TodayIcon, end: true },
  { to: '/meals', label: 'Meals', icon: MealsIcon },
  { to: '/history', label: 'History', icon: HistoryIcon },
  { to: '/settings', label: 'Settings', icon: GearIcon },
]

export function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[env(safe-area-inset-bottom)]">
      <div className="mx-3 mb-3 flex w-full max-w-md items-center justify-around rounded-[1.6rem] bg-surface/95 px-2 py-2 shadow-soft backdrop-blur">
        {tabs.map((t) => (
          <Tab key={t.to} {...t} />
        ))}
      </div>
    </nav>
  )
}

function Tab({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string
  label: string
  icon: (p: { active: boolean }) => ReactNode
  end?: boolean
}) {
  return (
    <NavLink to={to} end={end} className="flex flex-1 flex-col items-center gap-0.5 py-1" aria-label={label}>
      {({ isActive }) => (
        <>
          <Icon active={isActive} />
          <span
            className={cn('text-[0.62rem] font-bold', isActive ? 'text-accent' : 'text-ink-faint')}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}

function base(active: boolean) {
  return cn('transition-colors', active ? 'text-accent' : 'text-ink-faint')
}

function TodayIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={base(active)} aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function MealsIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={base(active)} aria-hidden>
      <path d="M6 3v8M9 3v8M6 11h3M7.5 11v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 3c-1.7 0-3 2-3 5s1.3 4 3 4m0-9v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function HistoryIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={base(active)} aria-hidden>
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 12a8.5 8.5 0 108.5-8.5A8.5 8.5 0 004 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M3.5 4.5V8H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function GearIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={base(active)} aria-hidden>
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 3l1.2 2.4 2.6-.6 1 2.5 2.5 1-.6 2.6L22 15l-2.4 1.2.6 2.6-2.5 1-1 2.5-2.6-.6L12 21l-1.2-2.4-2.6.6-1-2.5L4.7 15 2 12l2.4-1.2-.6-2.6 2.5-1 1-2.5 2.6.6z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        opacity={0.45}
      />
    </svg>
  )
}

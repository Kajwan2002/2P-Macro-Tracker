import { useState } from 'react'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { MacroBar, MacroLine } from '@/components/MacroBits'
import { PeriodNav } from '@/components/PeriodNav'
import { ProfileSwitcher } from '@/components/ProfileSwitcher'
import { Ring } from '@/components/Ring'
import { Screen } from '@/components/Screen'
import { dayTotals, useActiveProfile, useDayEntries } from '@/db/queries'
import type { LogEntry } from '@/db/types'
import { dayHeading, isTodayStr, shiftDay, todayStr } from '@/lib/dates'
import { fmtKcal, round1 } from '@/lib/macros'
import { EntryEditSheet } from '@/features/entries/EntryEditSheet'
import { AddEntrySheet } from './AddEntrySheet'

export function DashboardPage() {
  const profile = useActiveProfile()
  const [date, setDate] = useState(todayStr())
  const entries = useDayEntries(profile?.id, date)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<LogEntry | null>(null)

  const totals = dayTotals(entries ?? [])
  const kcalLeft = (profile?.kcalTarget ?? 0) - totals.kcal
  const proteinLeft = (profile?.proteinTarget ?? 0) - totals.protein

  return (
    <Screen title={dayHeading(date)} subtitle={profile?.name}>
      <ProfileSwitcher />

      <PeriodNav
        label={dayHeading(date)}
        onPrev={() => setDate((d) => shiftDay(d, -1))}
        onNext={() => setDate((d) => shiftDay(d, 1))}
        nextDisabled={isTodayStr(date)}
      />

      <Card className="flex justify-around gap-2 py-6">
        <Ring value={profile ? totals.kcal / Math.max(1, profile.kcalTarget) : 0} size={148} stroke={13}>
          <div>
            <div className="text-2xl font-extrabold text-ink">{fmtKcal(Math.max(0, kcalLeft))}</div>
            <div className="text-[0.65rem] font-bold text-ink-faint">
              {kcalLeft >= 0 ? 'kcal left' : 'kcal over'}
            </div>
            <div className="mt-0.5 text-[0.65rem] font-semibold text-ink-faint">
              {fmtKcal(totals.kcal)} / {fmtKcal(profile?.kcalTarget ?? 0)}
            </div>
          </div>
        </Ring>
        <Ring
          value={profile ? totals.protein / Math.max(1, profile.proteinTarget) : 0}
          size={148}
          stroke={13}
        >
          <div>
            <div className="text-2xl font-extrabold text-ink">{round1(Math.max(0, proteinLeft))}</div>
            <div className="text-[0.65rem] font-bold text-ink-faint">
              {proteinLeft >= 0 ? 'g protein left' : 'g over'}
            </div>
            <div className="mt-0.5 text-[0.65rem] font-semibold text-ink-faint">
              {round1(totals.protein)} / {profile?.proteinTarget ?? 0} g
            </div>
          </div>
        </Ring>
      </Card>

      <Card className="flex flex-col gap-3">
        <MacroBar
          label="Carbs"
          value={totals.carbs}
          target={profile?.carbsTarget ?? 0}
          color="var(--color-carbs)"
        />
        <MacroBar
          label="Fat"
          value={totals.fat}
          target={profile?.fatTarget ?? 0}
          color="var(--color-fat)"
        />
      </Card>

      <div className="flex flex-col gap-2">
        {(entries?.length ?? 0) === 0 ? (
          <EmptyState emoji="🍽️" title="Nothing logged yet" hint="Tap + to add a meal, food or a quick entry." />
        ) : (
          entries!.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setEditing(e)}
              className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-3.5 text-left shadow-card active:opacity-80"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold text-ink">{e.name}</span>
                  {e.mealEventId && (
                    <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.6rem] font-bold text-ink-faint">
                      split
                    </span>
                  )}
                  {e.source === 'group' && (
                    <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.6rem] font-bold text-ink-faint">
                      group
                    </span>
                  )}
                </div>
                <MacroLine macros={e} className="mt-0.5" />
              </div>
              <span className="shrink-0 font-extrabold text-ink">{fmtKcal(e.kcal)}</span>
            </button>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={() => setAdding(true)}
        aria-label="Add entry"
        className="fixed bottom-24 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-accent text-bg-deep shadow-soft active:scale-95"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </button>

      {profile && (
        <AddEntrySheet open={adding} onClose={() => setAdding(false)} profileId={profile.id} date={date} />
      )}
      <EntryEditSheet entry={editing} onClose={() => setEditing(null)} />
    </Screen>
  )
}

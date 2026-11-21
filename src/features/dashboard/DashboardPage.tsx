import { differenceInCalendarDays } from 'date-fns'
import { useState } from 'react'
import { Card } from '@/components/Card'
import { cn } from '@/lib/cn'
import { EmptyState } from '@/components/EmptyState'
import { MacroBar, MacroLine } from '@/components/MacroBits'
import { NumberField } from '@/components/NumberField'
import { PeriodNav } from '@/components/PeriodNav'
import { ProfileSwitcher } from '@/components/ProfileSwitcher'
import { Ring } from '@/components/Ring'
import { Screen } from '@/components/Screen'
import {
  countedKcal,
  dayTotals,
  useActiveProfile,
  useCheatDays,
  useDayEntries,
  useCoach,
  useIngredientMap,
  useWeekKcal,
} from '@/db/queries'
import { applyCoachTarget, setCheatDay } from '@/db/repo'
import { Button } from '@/components/Button'
import { useToast } from '@/components/Toast'
import { COACH_MIN_CHANGE, coachHeadline } from '@/lib/coach'
import { KCAL_PER_KG } from '@/lib/weight'
import type { LogEntry, Profile } from '@/db/types'
import { entryAmountText } from '@/lib/amount'
import { dayHeading, maxLogDate, parseISO, shiftDay, todayStr } from '@/lib/dates'
import { fmtKcal, round1 } from '@/lib/macros'
import { EntryEditSheet } from '@/features/entries/EntryEditSheet'
import { AddEntrySheet } from './AddEntrySheet'

export function DashboardPage() {
  const profile = useActiveProfile()
  const [date, setDate] = useState(todayStr())
  const entries = useDayEntries(profile?.id, date)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<LogEntry | null>(null)
  const cheat = useCheatDays(profile?.id)
  const isCheat = cheat?.has(date) ?? false
  const ingredientsById = useIngredientMap()
  const amountText = (e: LogEntry) => entryAmountText(e, ingredientsById)

  const totals = dayTotals(entries ?? [])
  const kcalLeft = (profile?.kcalTarget ?? 0) - totals.kcal
  const proteinLeft = (profile?.proteinTarget ?? 0) - totals.protein

  return (
    <Screen
      title={dayHeading(date)}
      subtitle={profile?.name}
      right={
        profile && (
          <button
            type="button"
            onClick={() => setCheatDay(profile.id, date, !isCheat)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold active:scale-95',
              isCheat ? 'bg-accent text-bg-deep' : 'bg-surface text-ink-faint',
            )}
          >
            Cheat day
          </button>
        )
      }
    >
      <ProfileSwitcher />

      <PeriodNav
        label={dayHeading(date)}
        onPrev={() => setDate((d) => shiftDay(d, -1))}
        onNext={() => setDate((d) => shiftDay(d, 1))}
        nextDisabled={date >= maxLogDate()}
      />

      {isCheat ? (
        <Card className="flex flex-col gap-3 py-5">
          <div className="text-center">
            <div className="font-extrabold text-ink">Cheat day</div>
            <div className="text-xs font-semibold text-ink-faint">
              Not judged against the daily target, but it still counts toward your week.
            </div>
          </div>
          {profile && (
            <NumberField
              label="Rough guess for the whole day (optional)"
              value={cheat?.get(date) ?? 0}
              onChange={(n) => setCheatDay(profile.id, date, true, n)}
              placeholder="e.g. 3000"
              suffix="kcal"
            />
          )}
          <div className="text-center text-xs font-semibold text-ink-faint">
            {fmtKcal(totals.kcal)} kcal logged · counting{' '}
            <span className="font-bold text-ink">{fmtKcal(countedKcal(date, totals.kcal, cheat))}</span>
          </div>
        </Card>
      ) : (
        <>
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
        </>
      )}

      {profile && <WeekCard profile={profile} date={date} />}

      {profile && profile.goalKgPerWeek != null && date === todayStr() && (
        <CoachCard profile={profile} />
      )}

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
                {amountText(e) && (
                  <div className="mt-0.5 truncate text-xs font-semibold text-ink-soft">{amountText(e)}</div>
                )}
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

/** The week's calorie budget: daily target × 7, so a lighter day leaves room for a bigger one. */
function WeekCard({ profile, date }: { profile: Profile; date: string }) {
  const week = useWeekKcal(profile.id, date)
  if (!week) return null
  const budget = profile.kcalTarget * 7
  const eaten = [...week.byDay.values()].reduce((s, k) => s + k, 0)
  const left = budget - eaten

  // for the current week: what each remaining day (today included) can average
  const today = todayStr()
  const isThisWeek = today >= week.from && today <= week.to
  const daysToGo = isThisWeek ? differenceInCalendarDays(parseISO(week.to), parseISO(today)) + 1 : 0
  const eatenBeforeToday = [...week.byDay].reduce((s, [d, k]) => (d < today ? s + k : s), 0)
  const perDay = daysToGo ? (budget - eatenBeforeToday) / daysToGo : 0
  // where you'd be by tonight eating exactly the target every day so far
  const pace = isThisWeek ? profile.kcalTarget * (8 - daysToGo) : 0
  const vsPace = eaten - pace
  const pct = (n: number) => `${Math.min(100, (n / Math.max(1, budget)) * 100)}%`
  // the real balance: eaten vs. what the body burned on the days tracked so far
  // (same numbers as History's weekly balance)
  const burn = week.burn ?? profile.maintenanceKcal ?? null
  const daysTracked = [...week.byDay.values()].filter((k) => k > 0).length
  const balance = burn ? Math.round(eaten - burn * daysTracked) : 0

  return (
    <Card className="flex flex-col gap-2 py-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-ink-soft">This week</span>
        <span className="text-sm font-semibold text-ink-faint">
          <span className="font-extrabold text-ink">{fmtKcal(eaten)}</span> / {fmtKcal(budget)} kcal
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-surface-2">
        <div
          className={cn('h-full rounded-full', left < 0 ? 'bg-over' : 'bg-accent')}
          style={{ width: pct(eaten) }}
        />
        {isThisWeek && (
          <div
            className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-ink"
            style={{ left: pct(pace) }}
            aria-hidden
          />
        )}
      </div>
      {isThisWeek && (
        <div className="text-xs font-semibold text-ink-faint">
          On pace by tonight: {fmtKcal(pace)} ·{' '}
          <span className={cn('font-bold', vsPace > 0 ? 'text-over' : 'text-ink')}>
            {vsPace > 0 ? `${fmtKcal(vsPace)} over` : `${fmtKcal(-vsPace)} under`}
          </span>
        </div>
      )}
      <div className="text-xs font-semibold text-ink-faint">
        {left >= 0 ? `${fmtKcal(left)} left` : `${fmtKcal(-left)} over`}
        {daysToGo > 0 &&
          ` · ≈ ${fmtKcal(Math.max(0, Math.round(perDay)))}/day for ${daysToGo === 1 ? 'today' : `the next ${daysToGo} days`}`}
      </div>
      {burn && daysTracked > 0 && (
        <div className="mt-1 flex items-baseline justify-between gap-2 border-t border-surface-2 pt-2">
          <span className="text-xs font-semibold text-ink-faint">
            Vs. your burn (≈ {fmtKcal(burn)} × {daysTracked} day{daysTracked === 1 ? '' : 's'})
          </span>
          <span className="shrink-0 text-right">
            <span className={cn('font-extrabold', balance > 0 ? 'text-over' : 'text-accent')}>
              {balance > 0 ? '+' : balance < 0 ? '−' : ''}
              {fmtKcal(Math.abs(balance))}
            </span>
            {Math.abs(balance) >= 100 && (
              <span className="ml-1 text-[0.65rem] font-semibold text-ink-faint">
                ≈ {balance > 0 ? '+' : '−'}
                {(Math.abs(balance) / KCAL_PER_KG).toFixed(2)} kg
              </span>
            )}
          </span>
        </div>
      )}
    </Card>
  )
}

/**
 * The smart part: learns the real burn rate from logged food + the weight trend,
 * says whether the goal pace is being hit, and suggests a new target when it should
 * change. Nothing changes until "Update target" is tapped.
 */
function CoachCard({ profile }: { profile: Profile }) {
  const toast = useToast()
  const coach = useCoach(profile)
  if (!coach || coach.kind === 'off') return null

  if (coach.kind === 'learning') {
    return (
      <Card className="py-4">
        <div className="text-sm font-bold text-ink-soft">Coach</div>
        <p className="mt-0.5 text-xs text-ink-faint">
          Learning your body — log your food and weigh in 3+ times a week. The first check-in
          comes after about 2 weeks.
        </p>
      </Card>
    )
  }

  const { goal, maintenance, advice, cooldownDays } = coach
  const rate = `${advice.losing >= 0 ? 'losing' : 'gaining'} ${Math.abs(advice.losing).toFixed(2)} kg/week`
  const headline = coachHeadline(advice.status, goal)
  const change = advice.suggested - profile.kcalTarget
  const why =
    advice.status === 'slow'
      ? 'To hit your goal'
      : advice.status === 'fast'
        ? 'To slow down to your goal'
        : 'To match what is already working'

  async function apply() {
    await applyCoachTarget(profile, advice.suggested, maintenance)
    toast('Target updated')
  }

  return (
    <Card className="flex flex-col gap-2 py-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-ink-soft">Coach</span>
        <span
          className={cn(
            'text-xs font-bold',
            advice.status === 'on-track' ? 'text-accent' : 'text-over',
          )}
        >
          {headline}
        </span>
      </div>
      <p className="text-xs text-ink-faint">
        You're {rate}
        {goal > 0 ? ` (goal ${goal} kg)` : ''} and burning about{' '}
        <span className="font-bold text-ink">{fmtKcal(maintenance)}</span> kcal/day.
      </p>
      {cooldownDays > 0 ? (
        <p className="text-xs text-ink-faint">
          Target updated recently — next check-in in {cooldownDays} day
          {cooldownDays === 1 ? '' : 's'}.
        </p>
      ) : Math.abs(change) >= COACH_MIN_CHANGE ? (
        <>
          <p className="text-xs text-ink-faint">
            {why}: <span className="font-bold text-ink">{fmtKcal(advice.suggested)}</span>{' '}
            kcal/day (now {fmtKcal(profile.kcalTarget)}, {change > 0 ? '+' : '−'}
            {fmtKcal(Math.abs(change))}). Protein stays; carbs and fat adjust.
          </p>
          <Button full variant="soft" onClick={apply}>
            Update target
          </Button>
        </>
      ) : (
        <p className="text-xs text-ink-faint">Your target fits your goal — no change needed.</p>
      )}
    </Card>
  )
}

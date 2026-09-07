import { useState } from 'react'
import { BarChart } from '@/components/BarChart'
import { Button } from '@/components/Button'
import { Card, SectionTitle } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { LineChart } from '@/components/LineChart'
import { MacroLine } from '@/components/MacroBits'
import { NumberField } from '@/components/NumberField'
import { ProfileSwitcher } from '@/components/ProfileSwitcher'
import { Screen } from '@/components/Screen'
import { Segmented } from '@/components/Segmented'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import {
  dayTotals,
  useActiveProfile,
  useDayEntries,
  useLoggedDays,
  useRecentDays,
  useWeights,
} from '@/db/queries'
import { deleteWeight, setWeight } from '@/db/repo'
import type { LogEntry } from '@/db/types'
import { dayHeading, shortDate, todayStr, weekdayShort } from '@/lib/dates'
import { fmtKcal, round1 } from '@/lib/macros'
import { EntryEditSheet } from '@/features/entries/EntryEditSheet'

export function HistoryPage() {
  const profile = useActiveProfile()
  const [range, setRange] = useState<'7' | '30'>('7')
  const days = useRecentDays(profile?.id, range === '7' ? 7 : 30)
  const logged = useLoggedDays(profile?.id)
  const [openDay, setOpenDay] = useState<string | null>(null)

  const loggedInRange = (days ?? []).filter((d) => d.macros.kcal > 0)
  const nLogged = loggedInRange.length || 1
  const avgKcal = Math.round(loggedInRange.reduce((s, d) => s + d.macros.kcal, 0) / nLogged)
  const avgProtein = round1(loggedInRange.reduce((s, d) => s + d.macros.protein, 0) / nLogged)

  return (
    <Screen title="History" subtitle={profile?.name}>
      <ProfileSwitcher />
      <Segmented
        options={[
          { value: '7', label: '7 days' },
          { value: '30', label: '30 days' },
        ]}
        value={range}
        onChange={setRange}
      />

      <Card className="flex flex-col gap-2">
        <SectionTitle className="px-0">Calories</SectionTitle>
        <BarChart
          height={130}
          formatValue={fmtKcal}
          bars={(days ?? []).map((d) => ({
            label: range === '7' ? weekdayShort(d.date) : d.date.slice(5).replace('-', '/'),
            value: Math.round(d.macros.kcal),
            target: profile?.kcalTarget,
            highlight: d.date === todayStr(),
          }))}
        />
        <p className="text-xs text-ink-faint">
          Avg on logged days: <span className="font-bold text-ink">{fmtKcal(avgKcal || 0)}</span> kcal
          {profile ? ` · target ${fmtKcal(profile.kcalTarget)}` : ''}
        </p>
      </Card>

      <Card className="flex flex-col gap-2">
        <SectionTitle className="px-0">Protein</SectionTitle>
        <BarChart
          height={110}
          color="var(--color-protein)"
          highlightColor="var(--color-accent)"
          formatValue={(v) => `${round1(v)} g`}
          bars={(days ?? []).map((d) => ({
            label: range === '7' ? weekdayShort(d.date) : d.date.slice(5).replace('-', '/'),
            value: round1(d.macros.protein),
            target: profile?.proteinTarget,
            highlight: d.date === todayStr(),
          }))}
        />
        <p className="text-xs text-ink-faint">
          Avg: <span className="font-bold text-ink">{avgProtein} g</span>
          {profile ? ` · target ${profile.proteinTarget} g` : ''}
        </p>
      </Card>

      {profile && <WeightSection profileId={profile.id} />}

      <SectionTitle>Logged days</SectionTitle>
      {logged && logged.length === 0 && (
        <EmptyState emoji="📆" title="No history yet" hint="Days you log will show up here." />
      )}
      <div className="flex flex-col gap-2">
        {logged?.map((d) => (
          <button
            key={d.date}
            type="button"
            onClick={() => setOpenDay(d.date)}
            className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-3.5 text-left shadow-card active:opacity-80"
          >
            <div className="min-w-0">
              <div className="truncate font-bold text-ink">{dayHeading(d.date)}</div>
              <MacroLine macros={d.macros} className="mt-0.5" />
            </div>
            <div className="shrink-0 text-right">
              <div className="font-extrabold text-ink">{fmtKcal(d.macros.kcal)}</div>
              {profile && (
                <div className="text-[0.65rem] font-semibold text-ink-faint">
                  {Math.round((d.macros.kcal / Math.max(1, profile.kcalTarget)) * 100)}% of target
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {openDay && profile && (
        <DayEntriesSheet profileId={profile.id} date={openDay} onClose={() => setOpenDay(null)} />
      )}
    </Screen>
  )
}

function WeightSection({ profileId }: { profileId: string }) {
  const toast = useToast()
  const weights = useWeights(profileId)
  const [open, setOpen] = useState(false)
  const [kg, setKg] = useState(0)
  const [date, setDate] = useState(todayStr())

  const points = (weights ?? []).map((w) => ({ x: w.date.slice(5), y: w.kg }))
  const latest = weights && weights.length ? weights[weights.length - 1] : null

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionTitle className="px-0">Body weight</SectionTitle>
        <button
          type="button"
          onClick={() => {
            setKg(latest?.kg ?? 0)
            setDate(todayStr())
            setOpen(true)
          }}
          className="text-sm font-bold text-accent"
        >
          + Log
        </button>
      </div>
      <LineChart points={points} formatY={(v) => `${v} kg`} />
      {latest && (
        <p className="text-xs text-ink-faint">
          Latest: <span className="font-bold text-ink">{latest.kg} kg</span> on {shortDate(latest.date)}
        </p>
      )}

      {weights && weights.length > 0 && (
        <div className="flex flex-col">
          {[...weights].reverse().slice(0, 6).map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between border-b border-surface-2 py-2 text-sm last:border-0"
            >
              <span className="text-ink-soft">{shortDate(w.date)}</span>
              <span className="flex items-center gap-3">
                <span className="font-bold text-ink">{w.kg} kg</span>
                <button
                  type="button"
                  onClick={() => deleteWeight(w.id)}
                  className="text-xs font-bold text-over"
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Log weight">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[0.7rem] font-bold text-ink-soft">Date</span>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-2xl bg-surface-2 px-3 py-2.5 font-bold text-ink outline-none"
            />
          </label>
          <NumberField label="Weight" value={kg} onChange={setKg} suffix="kg" />
          <Button
            full
            onClick={async () => {
              if (kg <= 0) {
                toast('Enter a weight')
                return
              }
              await setWeight(profileId, date, kg)
              toast('Saved')
              setOpen(false)
            }}
          >
            Save
          </Button>
        </div>
      </Sheet>
    </Card>
  )
}

function DayEntriesSheet({
  profileId,
  date,
  onClose,
}: {
  profileId: string
  date: string
  onClose: () => void
}) {
  const entries = useDayEntries(profileId, date)
  const [editing, setEditing] = useState<LogEntry | null>(null)
  const totals = dayTotals(entries ?? [])

  return (
    <>
      <Sheet open onClose={onClose} title={dayHeading(date)}>
        <div className="mb-3 rounded-2xl bg-surface p-3">
          <div className="font-extrabold text-ink">{fmtKcal(totals.kcal)} kcal</div>
          <MacroLine macros={totals} className="mt-0.5" />
        </div>
        <div className="flex flex-col gap-2">
          {entries?.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setEditing(e)}
              className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-3 text-left active:opacity-80"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-ink">{e.name}</div>
                <MacroLine macros={e} className="mt-0.5" />
              </div>
              <span className="shrink-0 font-bold text-ink">{fmtKcal(e.kcal)}</span>
            </button>
          ))}
          {(entries?.length ?? 0) === 0 && (
            <p className="py-6 text-center text-sm text-ink-faint">No entries</p>
          )}
        </div>
      </Sheet>
      <EntryEditSheet entry={editing} onClose={() => setEditing(null)} />
    </>
  )
}

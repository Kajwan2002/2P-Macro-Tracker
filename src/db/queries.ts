import { useLiveQuery } from 'dexie-react-hooks'
import { lastNDays, shiftDay, todayStr, weekRange, type DateStr } from '@/lib/dates'
import { addMacros, ZERO_MACROS, type Macros } from '@/lib/macros'
import { COACH_COOLDOWN_DAYS, coachAdvice, type CoachAdvice } from '@/lib/coach'
import { estimateMaintenance, weightTrend } from '@/lib/weight'
import { db } from './db'
import { getSettings } from './repo'
import type {
  ChatMessage,
  Ingredient,
  LogEntry,
  Meal,
  MealEvent,
  Profile,
  QuickMeal,
  Settings,
  WeightEntry,
} from './types'

/* ------------------------------- settings ------------------------------- */

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => getSettings(), [])
}

/* ------------------------------- profiles ------------------------------- */

export function useProfiles(): Profile[] | undefined {
  return useLiveQuery(() => db.profiles.orderBy('sortOrder').toArray(), [])
}

export function useProfile(id: string | null | undefined): Profile | undefined {
  return useLiveQuery(() => (id ? db.profiles.get(id) : undefined), [id])
}

/** The active profile, falling back to the first one if the setting is stale. */
export function useActiveProfile(): Profile | undefined {
  return useLiveQuery(async () => {
    const s = await getSettings()
    if (s.activeProfileId) {
      const p = await db.profiles.get(s.activeProfileId)
      if (p) return p
    }
    return db.profiles.orderBy('sortOrder').first()
  }, [])
}

/* ------------------------------ ingredients ----------------------------- */

export function useIngredients(): Ingredient[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.ingredients.toArray()
    return all.sort((a, b) => a.name.localeCompare(b.name))
  }, [])
}

export function useIngredientMap(): Map<string, Ingredient> | undefined {
  return useLiveQuery(async () => {
    const all = await db.ingredients.toArray()
    return new Map(all.map((i) => [i.id, i]))
  }, [])
}

/* --------------------------------- meals -------------------------------- */

export function useMeals(): Meal[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.meals.toArray()
    return all.sort((a, b) => b.updatedAt - a.updatedAt)
  }, [])
}

export function useMeal(id: string | null | undefined): Meal | undefined {
  return useLiveQuery(() => (id ? db.meals.get(id) : undefined), [id])
}

/* ----------------------------- quick meals ---------------------------- */

export function useQuickMeals(): QuickMeal[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.quickMeals.toArray()
    return all.sort((a, b) => b.updatedAt - a.updatedAt)
  }, [])
}

/* ------------------------------ log entries ----------------------------- */

export function useLogEntry(id: string | null): LogEntry | undefined {
  return useLiveQuery(() => (id ? db.logEntries.get(id) : undefined), [id])
}

export function useMealEvent(id: string | null | undefined): MealEvent | undefined {
  return useLiveQuery(() => (id ? db.mealEvents.get(id) : undefined), [id])
}

export function useDayEntries(profileId: string | undefined, date: DateStr): LogEntry[] | undefined {
  return useLiveQuery(async () => {
    if (!profileId) return []
    const rows = await db.logEntries.where('[profileId+date]').equals([profileId, date]).toArray()
    return rows.sort((a, b) => a.createdAt - b.createdAt)
  }, [profileId, date])
}

export function dayTotals(entries: LogEntry[]): Macros {
  return entries.reduce(
    (acc, e) => addMacros(acc, { kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat }),
    ZERO_MACROS,
  )
}

export interface DayTotal {
  date: DateStr
  macros: Macros
}

/** Per-day totals for the last `n` days for one profile (oldest first). */
export function useRecentDays(
  profileId: string | undefined,
  n: number,
): DayTotal[] | undefined {
  return useLiveQuery(async () => {
    if (!profileId) return []
    const days = lastNDays(n)
    const from = days[0]
    const all = await db.logEntries.where('profileId').equals(profileId).toArray()
    const rows = all.filter((e) => e.date >= from)
    const byDay = new Map<string, Macros>()
    for (const e of rows) {
      const cur = byDay.get(e.date) ?? ZERO_MACROS
      byDay.set(e.date, addMacros(cur, { kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat }))
    }
    return days.map((date) => ({ date, macros: byDay.get(date) ?? ZERO_MACROS }))
  }, [profileId, n])
}

/** Distinct logged days for a profile, newest first (for the History list). */
export function useLoggedDays(profileId: string | undefined): DayTotal[] | undefined {
  return useLiveQuery(async () => {
    if (!profileId) return []
    const rows = await db.logEntries.where('profileId').equals(profileId).toArray()
    const byDay = new Map<string, Macros>()
    for (const e of rows) {
      const cur = byDay.get(e.date) ?? ZERO_MACROS
      byDay.set(e.date, addMacros(cur, { kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat }))
    }
    return [...byDay.entries()]
      .map(([date, macros]) => ({ date, macros }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [profileId])
}

/* ------------------------------ cheat days ------------------------------ */

/** A profile's cheat days: date → rough kcal estimate (null when none was given). */
export type CheatMap = Map<DateStr, number | null>

export function useCheatDays(profileId: string | undefined): CheatMap | undefined {
  return useLiveQuery(async () => {
    if (!profileId) return new Map() as CheatMap
    const rows = await db.cheatDays.where('profileId').equals(profileId).toArray()
    return new Map(rows.map((r) => [r.date, r.kcal ?? null])) as CheatMap
  }, [profileId])
}

/** Calories a day counts for: on a cheat day, the estimate if it's higher than what was logged. */
export function countedKcal(date: DateStr, loggedKcal: number, cheat: CheatMap | undefined): number {
  return Math.max(loggedKcal, cheat?.get(date) ?? 0)
}

/** Logged kcal per day from `from` on, with cheat-day estimates applied (see countedKcal). */
async function countedByDay(profileId: string, from: DateStr, to = '9999-12-31'): Promise<Map<DateStr, number>> {
  const [rows, cheats] = await Promise.all([
    db.logEntries.where('[profileId+date]').between([profileId, from], [profileId, to], true, true).toArray(),
    db.cheatDays.where('profileId').equals(profileId).toArray(),
  ])
  const byDay = new Map<DateStr, number>()
  for (const e of rows) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.kcal)
  const cheat: CheatMap = new Map(cheats.map((c) => [c.date, c.kcal ?? null]))
  for (const [d, est] of cheat) {
    if (d >= from && d <= to && est) byDay.set(d, countedKcal(d, byDay.get(d) ?? 0, cheat))
  }
  return byDay
}

export interface WeekKcal {
  from: DateStr
  to: DateStr
  byDay: Map<DateStr, number>
}

/** Counted kcal per day for the Mon–Sun week containing `date`. */
export async function loadWeekKcal(profileId: string, date: DateStr): Promise<WeekKcal> {
  const [from, to] = weekRange(date)
  return { from, to, byDay: await countedByDay(profileId, from, to) }
}

export function useWeekKcal(profileId: string | undefined, date: DateStr): WeekKcal | undefined {
  return useLiveQuery(async () => {
    if (!profileId) return { from: weekRange(date)[0], to: weekRange(date)[1], byDay: new Map() }
    return loadWeekKcal(profileId, date)
  }, [profileId, date])
}

export interface WeekTotal {
  /** Monday */
  from: DateStr
  /** Sunday */
  to: DateStr
  /** counted kcal (cheat-day estimates included) */
  kcal: number
  /** days with something logged or a cheat estimate */
  daysTracked: number
}

/** The last `n` Mon–Sun weeks (newest first), skipping weeks with nothing tracked. */
export async function loadWeekTotals(profileId: string, n: number): Promise<WeekTotal[]> {
  const [thisMonday] = weekRange(todayStr())
  const byDay = await countedByDay(profileId, shiftDay(thisMonday, -7 * (n - 1)))
  const weeks: WeekTotal[] = []
  for (let i = 0; i < n; i++) {
    const mon = shiftDay(thisMonday, -7 * i)
    const sun = shiftDay(mon, 6)
    let kcal = 0
    let daysTracked = 0
    for (const [d, k] of byDay) {
      if (d >= mon && d <= sun && k > 0) {
        kcal += k
        daysTracked++
      }
    }
    if (daysTracked) weeks.push({ from: mon, to: sun, kcal, daysTracked })
  }
  return weeks
}

export function useWeekTotals(profileId: string | undefined, n: number): WeekTotal[] | undefined {
  return useLiveQuery(async () => (profileId ? loadWeekTotals(profileId, n) : []), [profileId, n])
}

async function sortedWeights(profileId: string): Promise<WeightEntry[]> {
  const rows = await db.weights.where('profileId').equals(profileId).toArray()
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

/** Maintenance estimated from the last 4 weeks of food + weight (null with too little data). */
export async function loadMaintenanceEstimate(profileId: string): Promise<number | null> {
  const byDay = await countedByDay(profileId, shiftDay(todayStr(), -27))
  // today is usually only half-logged — leave it out
  const days = [...byDay].filter(([d, k]) => d < todayStr() && k > 0).map(([, k]) => k)
  return estimateMaintenance(await sortedWeights(profileId), days)
}

export function useMaintenanceEstimate(profileId: string | undefined): number | null | undefined {
  return useLiveQuery(async () => (profileId ? loadMaintenanceEstimate(profileId) : null), [profileId])
}

/* --------------------------------- coach -------------------------------- */

export type CoachState =
  | { kind: 'off' }
  | { kind: 'learning' }
  | {
      kind: 'ready'
      goal: number
      maintenance: number
      advice: CoachAdvice
      /** days left before the next suggestion, after a recent change (0 = can suggest now) */
      cooldownDays: number
    }

/** Everything the coach knows about a profile right now (same for the Today card and the assistant). */
export async function loadCoach(profile: Profile): Promise<CoachState> {
  const goal = profile.goalKgPerWeek
  if (goal == null) return { kind: 'off' }
  const [maintenance, weights] = await Promise.all([
    loadMaintenanceEstimate(profile.id),
    sortedWeights(profile.id),
  ])
  const perWeek = weightTrend(weights)?.perWeek ?? null
  if (maintenance === null || perWeek === null) return { kind: 'learning' }
  const since = profile.coachUpdatedAt
    ? Math.floor((Date.now() - profile.coachUpdatedAt) / 86_400_000)
    : Infinity
  return {
    kind: 'ready',
    goal,
    maintenance,
    advice: coachAdvice(profile, goal, maintenance, perWeek),
    cooldownDays: Math.max(0, COACH_COOLDOWN_DAYS - since),
  }
}

export function useCoach(profile: Profile): CoachState | undefined {
  return useLiveQuery(() => loadCoach(profile), [profile])
}

/* -------------------------------- weight -------------------------------- */

export function useChat(): ChatMessage[] | undefined {
  return useLiveQuery(() => db.chatMessages.orderBy('createdAt').toArray(), [])
}

export function useWeights(profileId: string | undefined): WeightEntry[] | undefined {
  return useLiveQuery(async () => (profileId ? sortedWeights(profileId) : []), [profileId])
}

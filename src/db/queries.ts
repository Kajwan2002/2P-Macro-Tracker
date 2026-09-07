import { useLiveQuery } from 'dexie-react-hooks'
import { lastNDays, type DateStr } from '@/lib/dates'
import { addMacros, ZERO_MACROS, type Macros } from '@/lib/macros'
import { db } from './db'
import { getSettings } from './repo'
import type {
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

/* -------------------------------- weight -------------------------------- */

export function useWeights(profileId: string | undefined): WeightEntry[] | undefined {
  return useLiveQuery(async () => {
    if (!profileId) return []
    const rows = await db.weights.where('profileId').equals(profileId).toArray()
    return rows.sort((a, b) => a.date.localeCompare(b.date))
  }, [profileId])
}

import Dexie, { type EntityTable } from 'dexie'
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

// Local-only database. Everything lives on the device; the backup file in
// Settings is the way to move / restore data.
export const db = new Dexie('macro-tracker') as Dexie & {
  profiles: EntityTable<Profile, 'id'>
  ingredients: EntityTable<Ingredient, 'id'>
  meals: EntityTable<Meal, 'id'>
  quickMeals: EntityTable<QuickMeal, 'id'>
  logEntries: EntityTable<LogEntry, 'id'>
  mealEvents: EntityTable<MealEvent, 'id'>
  weights: EntityTable<WeightEntry, 'id'>
  settings: EntityTable<Settings, 'id'>
}

db.version(1).stores({
  profiles: 'id, sortOrder',
  ingredients: 'id, name, isDefault',
  meals: 'id, name',
  logEntries: 'id, date, profileId, [profileId+date], mealEventId',
  mealEvents: 'id, date',
  weights: 'id, [profileId+date], profileId, date',
  settings: 'id',
})

// v2 — saved macros-only "quick meals"
db.version(2).stores({
  quickMeals: 'id, name',
})

/** Ask the browser to keep our data (helps on iOS home-screen installs). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true
    if (navigator.storage?.persist) return await navigator.storage.persist()
  } catch {
    /* not supported — fine */
  }
  return false
}

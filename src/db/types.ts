import type { DateStr } from '@/lib/dates'

/* ------------------------------- profiles ------------------------------- */

export interface Profile {
  id: string
  name: string
  /** accent id from theme/accents.ts */
  accent: string
  kcalTarget: number
  proteinTarget: number
  carbsTarget: number
  fatTarget: number
  sortOrder: number
  createdAt: number
  updatedAt: number
}

/* ------------------------------ ingredients ----------------------------- */

/** All macro values are per 100 g. */
export interface Ingredient {
  id: string
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  /** grams in "1 piece" (1 egg, 1 slice…). null = no piece unit. */
  pieceGrams: number | null
  /** label for the piece unit, e.g. "egg", "slice", "scoop" */
  pieceLabel: string
  isDefault: boolean
  createdAt: number
  updatedAt: number
}

/* --------------------------------- meals -------------------------------- */

export interface MealItem {
  ingredientId: string
  grams: number
}

/** A saved recipe. Totals are computed live from current ingredient values. */
export interface Meal {
  id: string
  name: string
  items: MealItem[]
  /** how many servings the whole recipe makes (for per-serving display) */
  servings: number
  recipeText: string
  createdAt: number
  updatedAt: number
}

/* ---------------------------- quick meals ------------------------------ */

/** A saved macros-only entry (no ingredients) — e.g. a sandwich from a café. */
export interface QuickMeal {
  id: string
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  createdAt: number
  updatedAt: number
}

/* ------------------------------ log entries ----------------------------- */

export type LogSource = 'ingredient' | 'meal' | 'quick' | 'group'

/** One food eaten by one person on one day. Macros are snapshotted. */
export interface LogEntry {
  id: string
  profileId: string
  date: DateStr
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  source: LogSource
  /** ingredientId or mealId this came from (for reference / re-log) */
  sourceId: string | null
  /** portion size in grams, when meaningful */
  grams: number | null
  /** set when this entry is one side of a shared (split) cook */
  mealEventId: string | null
  createdAt: number
  updatedAt: number
}

/* ------------------------------ meal events ----------------------------- */

export type SplitMode = 'pct' | 'grams'

export interface MealSplit {
  profileId: string
  mode: SplitMode
  /** percent of the whole cooked meal (pct mode) or grams eaten (grams mode) */
  value: number
  kcal: number
  protein: number
  carbs: number
  fat: number
}

/** One cook that was divided between profiles. Keeps the portions linked. */
export interface MealEvent {
  id: string
  date: DateStr
  name: string
  mealId: string | null
  /** macros of the whole cooked meal */
  kcal: number
  protein: number
  carbs: number
  fat: number
  /** cooked weight, when known (grams-mode splits) */
  totalGrams: number | null
  splits: MealSplit[]
  createdAt: number
  updatedAt: number
}

/* -------------------------------- weight -------------------------------- */

export interface WeightEntry {
  id: string
  profileId: string
  date: DateStr
  kg: number
  createdAt: number
}

/* ------------------------------- settings ------------------------------- */

export interface Settings {
  id: 'app'
  activeProfileId: string | null
  seeded: boolean
  lastBackupAt: number | null
  createdAt: number
}

export const DEFAULT_SETTINGS: Omit<Settings, 'createdAt'> = {
  id: 'app',
  activeProfileId: null,
  seeded: false,
  lastBackupAt: null,
}

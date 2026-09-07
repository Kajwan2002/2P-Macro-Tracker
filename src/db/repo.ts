import { todayStr } from '@/lib/dates'
import { newId } from '@/lib/id'
import { roundMacros, type Macros } from '@/lib/macros'
import { db } from './db'
import {
  DEFAULT_SETTINGS,
  type Ingredient,
  type LogEntry,
  type LogSource,
  type Meal,
  type MealItem,
  type MealSplit,
  type Profile,
  type Settings,
} from './types'

/* ------------------------------- settings ------------------------------- */

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('app')
  return { ...DEFAULT_SETTINGS, createdAt: Date.now(), ...s }
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch, id: 'app' })
}

export async function setActiveProfile(profileId: string): Promise<void> {
  await updateSettings({ activeProfileId: profileId })
}

/* ------------------------------- profiles ------------------------------- */

export interface ProfileInput {
  name: string
  accent: string
  kcalTarget: number
  proteinTarget: number
  carbsTarget: number
  fatTarget: number
}

export async function addProfile(input: ProfileInput): Promise<string> {
  const now = Date.now()
  const id = newId()
  const count = await db.profiles.count()
  await db.profiles.add({
    id,
    name: input.name.trim() || 'Profile',
    accent: input.accent,
    kcalTarget: clampInt(input.kcalTarget),
    proteinTarget: clampInt(input.proteinTarget),
    carbsTarget: clampInt(input.carbsTarget),
    fatTarget: clampInt(input.fatTarget),
    sortOrder: count,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export async function updateProfile(
  id: string,
  patch: Partial<Omit<Profile, 'id' | 'sortOrder' | 'createdAt' | 'updatedAt'>>,
): Promise<void> {
  const clean: Partial<Profile> = { ...patch, updatedAt: Date.now() }
  if (clean.name != null) clean.name = clean.name.trim() || 'Profile'
  for (const k of ['kcalTarget', 'proteinTarget', 'carbsTarget', 'fatTarget'] as const) {
    if (clean[k] != null) clean[k] = clampInt(clean[k] as number)
  }
  await db.profiles.update(id, clean)
}

/** Delete a profile and everything logged for it. Refuses the last profile. */
export async function deleteProfile(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.profiles, db.logEntries, db.weights, db.mealEvents, db.settings],
    async () => {
      const remaining = await db.profiles.count()
      if (remaining <= 1) throw new Error('You need at least one profile.')

      await db.logEntries.where('profileId').equals(id).delete()
      await db.weights.where('profileId').equals(id).delete()

      // drop this profile from any split; delete events left with no splits
      const events = await db.mealEvents.toArray()
      for (const ev of events) {
        if (!ev.splits.some((s) => s.profileId === id)) continue
        const splits = ev.splits.filter((s) => s.profileId !== id)
        if (splits.length === 0) await db.mealEvents.delete(ev.id)
        else await db.mealEvents.update(ev.id, { splits, updatedAt: Date.now() })
      }

      await db.profiles.delete(id)

      const s = await getSettings()
      if (s.activeProfileId === id) {
        const first = await db.profiles.orderBy('sortOrder').first()
        await db.settings.put({ ...s, id: 'app', activeProfileId: first?.id ?? null })
      }
    },
  )
}

/* ------------------------------ ingredients ----------------------------- */

export interface IngredientInput {
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  pieceGrams: number | null
  pieceLabel: string
}

export async function addIngredient(input: IngredientInput): Promise<string> {
  const now = Date.now()
  const id = newId()
  await db.ingredients.add({ id, ...cleanIngredient(input), isDefault: false, createdAt: now, updatedAt: now })
  return id
}

export async function updateIngredient(id: string, input: IngredientInput): Promise<void> {
  await db.ingredients.update(id, { ...cleanIngredient(input), updatedAt: Date.now() })
}

/** How many saved meals use this ingredient. */
export async function ingredientUsage(id: string): Promise<number> {
  const meals = await db.meals.toArray()
  return meals.filter((m) => m.items.some((it) => it.ingredientId === id)).length
}

/** Delete an ingredient. Saved meals keep the item but count it as 0 (shown as a warning). */
export async function deleteIngredient(id: string): Promise<void> {
  await db.ingredients.delete(id)
}

function cleanIngredient(input: IngredientInput) {
  const piece = input.pieceGrams != null && input.pieceGrams > 0 ? round1(input.pieceGrams) : null
  return {
    name: input.name.trim() || 'Ingredient',
    kcal: nonNeg(input.kcal),
    protein: nonNeg(input.protein),
    carbs: nonNeg(input.carbs),
    fat: nonNeg(input.fat),
    pieceGrams: piece,
    pieceLabel: piece ? input.pieceLabel.trim() : '',
  }
}

/* --------------------------------- meals -------------------------------- */

export interface MealInput {
  name: string
  items: MealItem[]
  servings: number
  recipeText: string
}

export async function addMeal(input: MealInput): Promise<string> {
  const now = Date.now()
  const id = newId()
  await db.meals.add({ id, ...cleanMeal(input), createdAt: now, updatedAt: now })
  return id
}

export async function updateMeal(id: string, input: MealInput): Promise<void> {
  await db.meals.update(id, { ...cleanMeal(input), updatedAt: Date.now() })
}

export async function deleteMeal(id: string): Promise<void> {
  await db.meals.delete(id)
}

function cleanMeal(input: MealInput): Omit<Meal, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: input.name.trim() || 'Meal',
    items: input.items
      .filter((it) => it.ingredientId && it.grams > 0)
      .map((it) => ({ ingredientId: it.ingredientId, grams: round1(it.grams) })),
    servings: Math.max(1, Math.round(input.servings || 1)),
    recipeText: input.recipeText.trim(),
  }
}

/* ------------------------------ log entries ----------------------------- */

export interface LogEntryInput {
  profileId: string
  date: string
  name: string
  macros: Macros
  source: LogSource
  sourceId: string | null
  grams: number | null
}

export async function addLogEntry(input: LogEntryInput): Promise<string> {
  const now = Date.now()
  const id = newId()
  const m = roundMacros(input.macros)
  await db.logEntries.add({
    id,
    profileId: input.profileId,
    date: input.date || todayStr(),
    name: input.name.trim() || 'Entry',
    kcal: m.kcal,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    source: input.source,
    sourceId: input.sourceId,
    grams: input.grams != null ? round1(input.grams) : null,
    mealEventId: null,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export async function updateLogEntry(
  id: string,
  patch: { name?: string; macros?: Macros; grams?: number | null },
): Promise<void> {
  const clean: Partial<LogEntry> = { updatedAt: Date.now() }
  if (patch.name != null) clean.name = patch.name.trim() || 'Entry'
  if (patch.macros) {
    const m = roundMacros(patch.macros)
    clean.kcal = m.kcal
    clean.protein = m.protein
    clean.carbs = m.carbs
    clean.fat = m.fat
  }
  if (patch.grams !== undefined) clean.grams = patch.grams != null ? round1(patch.grams) : null

  const entry = await db.logEntries.get(id)
  if (!entry) return

  await db.transaction('rw', [db.logEntries, db.mealEvents], async () => {
    await db.logEntries.update(id, clean)
    // keep the parent meal event's split in sync
    if (entry.mealEventId && patch.macros) {
      const ev = await db.mealEvents.get(entry.mealEventId)
      if (ev) {
        const m = roundMacros(patch.macros)
        const splits = ev.splits.map((s) =>
          s.profileId === entry.profileId
            ? { ...s, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat }
            : s,
        )
        await db.mealEvents.update(ev.id, { splits, updatedAt: Date.now() })
      }
    }
  })
}

export async function deleteLogEntry(id: string): Promise<void> {
  const entry = await db.logEntries.get(id)
  if (!entry) return

  if (!entry.mealEventId) {
    await db.logEntries.delete(id)
    return
  }

  // one side of a shared cook: remove this side; drop the event if nothing is left
  await db.transaction('rw', [db.logEntries, db.mealEvents], async () => {
    await db.logEntries.delete(id)
    const ev = await db.mealEvents.get(entry.mealEventId!)
    if (!ev) return
    const splits = ev.splits.filter((s) => s.profileId !== entry.profileId)
    const others = await db.logEntries.where('mealEventId').equals(ev.id).count()
    if (splits.length === 0 || others === 0) await db.mealEvents.delete(ev.id)
    else await db.mealEvents.update(ev.id, { splits, updatedAt: Date.now() })
  })
}

/* ------------------------------ meal events ----------------------------- */

export interface SplitInput {
  profileId: string
  mode: MealSplit['mode']
  value: number
  macros: Macros
}

export interface MealEventInput {
  date: string
  name: string
  mealId: string | null
  total: Macros
  totalGrams: number | null
  splits: SplitInput[]
}

/** Create a shared cook: one meal event + one log entry per profile that ate. */
export async function addMealEvent(input: MealEventInput): Promise<string> {
  const now = Date.now()
  const eventId = newId()
  const total = roundMacros(input.total)
  const name = input.name.trim() || 'Meal'

  await db.transaction('rw', [db.mealEvents, db.logEntries], async () => {
    const splits: MealSplit[] = []
    for (const s of input.splits) {
      const m = roundMacros(s.macros)
      splits.push({
        profileId: s.profileId,
        mode: s.mode,
        value: round1(s.value),
        kcal: m.kcal,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
      })
      if (m.kcal <= 0 && m.protein <= 0 && m.carbs <= 0 && m.fat <= 0) continue
      await db.logEntries.add({
        id: newId(),
        profileId: s.profileId,
        date: input.date || todayStr(),
        name,
        kcal: m.kcal,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        source: 'meal',
        sourceId: input.mealId,
        grams: s.mode === 'grams' ? round1(s.value) : null,
        mealEventId: eventId,
        createdAt: now,
        updatedAt: now,
      })
    }

    await db.mealEvents.add({
      id: eventId,
      date: input.date || todayStr(),
      name,
      mealId: input.mealId,
      kcal: total.kcal,
      protein: total.protein,
      carbs: total.carbs,
      fat: total.fat,
      totalGrams: input.totalGrams != null ? round1(input.totalGrams) : null,
      splits,
      createdAt: now,
      updatedAt: now,
    })
  })

  return eventId
}

export async function deleteMealEvent(id: string): Promise<void> {
  await db.transaction('rw', [db.mealEvents, db.logEntries], async () => {
    await db.logEntries.where('mealEventId').equals(id).delete()
    await db.mealEvents.delete(id)
  })
}

/* -------------------------------- weight -------------------------------- */

export async function setWeight(profileId: string, date: string, kg: number): Promise<void> {
  const clean = Math.max(0, Math.round(kg * 10) / 10)
  const existing = await db.weights.where('[profileId+date]').equals([profileId, date]).first()
  if (existing) {
    await db.weights.update(existing.id, { kg: clean })
  } else {
    await db.weights.add({ id: newId(), profileId, date, kg: clean, createdAt: Date.now() })
  }
}

export async function deleteWeight(id: string): Promise<void> {
  await db.weights.delete(id)
}

/* -------------------------------- utils -------------------------------- */

function round1(n: number): number {
  return Math.round((Number(n) || 0) * 10) / 10
}
function nonNeg(n: number): number {
  return Math.max(0, round1(n))
}
function clampInt(n: number): number {
  return Math.max(0, Math.round(Number(n) || 0))
}

export type { Ingredient, Meal, Profile }

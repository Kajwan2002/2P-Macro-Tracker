import type { Ingredient, Meal, MealItem } from '@/db/types'

export interface Macros {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export const ZERO_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

export const MACRO_KEYS = ['kcal', 'protein', 'carbs', 'fat'] as const

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  }
}

export function scaleMacros(m: Macros, factor: number): Macros {
  return {
    kcal: m.kcal * factor,
    protein: m.protein * factor,
    carbs: m.carbs * factor,
    fat: m.fat * factor,
  }
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(addMacros, ZERO_MACROS)
}

/** kcal to whole numbers, grams to one decimal — for storage and display */
export function roundMacros(m: Macros): Macros {
  return {
    kcal: Math.round(m.kcal),
    protein: round1(m.protein),
    carbs: round1(m.carbs),
    fat: round1(m.fat),
  }
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** an ingredient's macros are stored per 100 g */
export function macrosForGrams(ing: Ingredient, grams: number): Macros {
  return scaleMacros(
    { kcal: ing.kcal, protein: ing.protein, carbs: ing.carbs, fat: ing.fat },
    grams / 100,
  )
}

export interface MealTotals {
  macros: Macros
  grams: number
  /** ids of items whose ingredient no longer exists */
  missing: string[]
}

export function mealTotals(meal: Meal, byId: Map<string, Ingredient>): MealTotals {
  let macros = ZERO_MACROS
  let grams = 0
  const missing: string[] = []
  for (const item of meal.items) {
    const ing = byId.get(item.ingredientId)
    if (!ing) {
      missing.push(item.ingredientId)
      continue
    }
    macros = addMacros(macros, macrosForGrams(ing, item.grams))
    grams += item.grams
  }
  return { macros, grams, missing }
}

export function itemMacros(item: MealItem, byId: Map<string, Ingredient>): Macros {
  const ing = byId.get(item.ingredientId)
  return ing ? macrosForGrams(ing, item.grams) : ZERO_MACROS
}

/** kcal implied by macros (4/4/9) — used to sanity-check manual entries */
export function impliedKcal(m: Pick<Macros, 'protein' | 'carbs' | 'fat'>): number {
  return m.protein * 4 + m.carbs * 4 + m.fat * 9
}

export function fmtKcal(n: number): string {
  return Math.round(n).toLocaleString()
}

export function fmtGrams(n: number): string {
  const r = round1(n)
  return (Number.isInteger(r) ? r.toString() : r.toFixed(1)) + ' g'
}

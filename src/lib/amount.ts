// Show an amount the way a person thinks of it: "2 slices" for things that
// come in pieces (ingredients with a piece size set), plus the grams.

import type { Ingredient, LogEntry } from '@/db/types'
import { round1 } from './macros'

type PieceInfo = Pick<Ingredient, 'pieceGrams' | 'pieceLabel'>
type IngredientMap = Map<string, Ingredient> | undefined

/** "2 slices" / "1 egg" / "1.5 wraps" — or null if this ingredient has no piece size. */
export function piecesText(grams: number, ing?: PieceInfo | null): string | null {
  if (!ing?.pieceGrams || ing.pieceGrams <= 0 || !(grams > 0)) return null
  const n = round1(grams / ing.pieceGrams)
  const label = (ing.pieceLabel ?? '').trim() || 'piece'
  return `${n} ${n === 1 ? label : `${label}s`}`
}

/** "2 slices · 60 g", or just "60 g" when there's no piece size. */
export function fmtAmount(grams: number, ing?: PieceInfo | null): string {
  const g = `${round1(grams)} g`
  const p = piecesText(grams, ing)
  return p ? `${p} · ${g}` : g
}

/** Short line for a dashboard row: what and how much was eaten. */
export function entryAmountText(e: LogEntry, byId: IngredientMap): string | null {
  if (e.source === 'ingredient' && e.grams) {
    return fmtAmount(e.grams, e.sourceId ? byId?.get(e.sourceId) : null)
  }
  if (e.source === 'group' && e.items?.length) {
    return e.items
      .map((it) => {
        const ing = it.ingredientId ? byId?.get(it.ingredientId) : null
        return `${piecesText(it.grams, ing) ?? `${round1(it.grams)} g`} ${it.name}`
      })
      .join(', ')
  }
  return null
}

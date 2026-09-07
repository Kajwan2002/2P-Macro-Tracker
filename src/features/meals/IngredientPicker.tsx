import { useMemo, useState } from 'react'
import { MacroLine } from '@/components/MacroBits'
import { useIngredients } from '@/db/queries'
import type { Ingredient } from '@/db/types'

interface IngredientPickerProps {
  onPick: (ingredient: Ingredient) => void
  footer?: React.ReactNode
}

export function IngredientPicker({ onPick, footer }: IngredientPickerProps) {
  const ingredients = useIngredients()
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const all = ingredients ?? []
    if (!needle) return all
    return all.filter((i) => i.name.toLowerCase().includes(needle))
  }, [ingredients, q])

  return (
    <div className="flex flex-col gap-2">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search ingredients…"
        className="rounded-2xl bg-surface-2 px-4 py-3 font-semibold text-ink outline-none placeholder:text-ink-faint"
      />
      {footer}
      <div className="flex flex-col">
        {list.map((ing) => (
          <button
            key={ing.id}
            type="button"
            onClick={() => onPick(ing)}
            className="flex items-center justify-between gap-3 border-b border-surface-2 py-3 text-left last:border-0 active:opacity-70"
          >
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink">{ing.name}</div>
              <MacroLine macros={ing} className="mt-0.5" />
            </div>
            <span className="shrink-0 text-xs font-bold text-ink-faint">{ing.kcal} kcal /100g</span>
          </button>
        ))}
        {list.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-faint">No matches</p>
        )}
      </div>
    </div>
  )
}

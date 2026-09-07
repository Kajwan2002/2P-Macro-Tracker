import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { MacroLine } from '@/components/MacroBits'
import { Screen } from '@/components/Screen'
import { Segmented } from '@/components/Segmented'
import { useIngredientMap, useIngredients, useMeals } from '@/db/queries'
import type { Ingredient } from '@/db/types'
import { fmtKcal, mealTotals } from '@/lib/macros'
import { IngredientFormSheet } from './IngredientFormSheet'

type Tab = 'meals' | 'ingredients'

export function MealsPage() {
  const [tab, setTab] = useState<Tab>('meals')
  return (
    <Screen title="Meals">
      <Segmented
        options={[
          { value: 'meals', label: 'Meals' },
          { value: 'ingredients', label: 'Ingredients' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'meals' ? <MealsTab /> : <IngredientsTab />}
    </Screen>
  )
}

function MealsTab() {
  const navigate = useNavigate()
  const meals = useMeals()
  const byId = useIngredientMap()

  return (
    <div className="flex flex-col gap-3">
      <Button full onClick={() => navigate('/meals/new')}>
        + New meal
      </Button>
      {meals && byId && meals.length === 0 && (
        <EmptyState
          emoji="🥘"
          title="No saved meals"
          hint="Save the recipes you cook often so you can log them in one tap."
        />
      )}
      {meals?.map((m) => {
        const t = byId ? mealTotals(m, byId).macros : { kcal: 0, protein: 0, carbs: 0, fat: 0 }
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => navigate(`/meals/${m.id}`)}
            className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 text-left shadow-card active:opacity-80"
          >
            <div className="min-w-0">
              <div className="truncate font-bold text-ink">{m.name}</div>
              <MacroLine macros={t} className="mt-0.5" />
              <div className="mt-0.5 text-xs text-ink-faint">
                {m.items.length} ingredient{m.items.length === 1 ? '' : 's'}
                {m.servings > 1 ? ` · ${m.servings} servings` : ''}
              </div>
            </div>
            <span className="shrink-0 font-extrabold text-ink">{fmtKcal(t.kcal)}</span>
          </button>
        )
      })}
    </div>
  )
}

function IngredientsTab() {
  const ingredients = useIngredients()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Ingredient | null>(null)
  const [creating, setCreating] = useState(false)

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const all = ingredients ?? []
    return needle ? all.filter((i) => i.name.toLowerCase().includes(needle)) : all
  }, [ingredients, q])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="min-w-0 flex-1 rounded-full bg-surface-2 px-4 py-2.5 font-semibold text-ink outline-none placeholder:text-ink-faint"
        />
        <Button onClick={() => setCreating(true)}>+ Add</Button>
      </div>

      <div className="flex flex-col rounded-2xl bg-surface px-4 shadow-card">
        {list.map((ing) => (
          <button
            key={ing.id}
            type="button"
            onClick={() => setEditing(ing)}
            className="flex items-center justify-between gap-3 border-b border-surface-2 py-3 text-left last:border-0 active:opacity-70"
          >
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink">{ing.name}</div>
              <MacroLine macros={ing} className="mt-0.5" />
            </div>
            <span className="shrink-0 text-xs font-bold text-ink-faint">
              {ing.kcal} kcal
              {ing.pieceGrams ? ` · 1 ${ing.pieceLabel || 'pc'} ${ing.pieceGrams}g` : ''}
            </span>
          </button>
        ))}
        {list.length === 0 && <p className="py-6 text-center text-sm text-ink-faint">No matches</p>}
      </div>

      <IngredientFormSheet open={creating} onClose={() => setCreating(false)} ingredient={null} />
      <IngredientFormSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        ingredient={editing}
      />
    </div>
  )
}

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { MacroLine } from '@/components/MacroBits'
import { Screen } from '@/components/Screen'
import { useIngredientMap, useMeal } from '@/db/queries'
import { fmtKcal, itemMacros, mealTotals } from '@/lib/macros'
import { LogMealSheet } from './LogMealSheet'

export function MealDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const meal = useMeal(id ?? null)
  const byId = useIngredientMap()
  const [logging, setLogging] = useState(false)

  if (!meal || !byId) {
    return (
      <Screen title="Meal" back="/meals">
        <p className="text-sm text-ink-faint">Loading…</p>
      </Screen>
    )
  }

  const { macros, missing } = mealTotals(meal, byId)

  return (
    <Screen
      title={meal.name}
      back="/meals"
      right={
        <button
          type="button"
          onClick={() => navigate(`/meals/${meal.id}/edit`)}
          className="text-sm font-bold text-ink-soft"
        >
          Edit
        </button>
      }
    >
      <div className="rounded-3xl bg-surface p-5 shadow-card">
        <div className="text-2xl font-extrabold text-ink">{fmtKcal(macros.kcal)} kcal</div>
        <MacroLine macros={macros} className="mt-1" />
        {meal.servings > 1 && (
          <div className="mt-2 text-sm text-ink-soft">
            {meal.servings} servings · {fmtKcal(macros.kcal / meal.servings)} kcal each
          </div>
        )}
      </div>

      {missing.length > 0 && (
        <p className="rounded-2xl bg-over/15 px-4 py-3 text-xs font-semibold text-over">
          {missing.length} ingredient{missing.length > 1 ? 's were' : ' was'} deleted and counts as 0.
          Edit the meal to fix.
        </p>
      )}

      <div className="flex flex-col rounded-2xl bg-surface px-4 shadow-card">
        {meal.items.map((it, i) => {
          const ing = byId.get(it.ingredientId)
          const m = itemMacros(it, byId)
          return (
            <div
              key={i}
              className="flex items-center justify-between gap-3 border-b border-surface-2 py-3 last:border-0"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-ink">{ing?.name ?? 'Deleted ingredient'}</div>
                <div className="text-xs text-ink-faint">{it.grams} g</div>
              </div>
              <span className="shrink-0 text-sm font-bold text-ink-soft">{fmtKcal(m.kcal)}</span>
            </div>
          )
        })}
      </div>

      {meal.recipeText && (
        <div className="rounded-2xl bg-surface p-4 shadow-card">
          <p className="mb-1 text-[0.7rem] font-bold text-ink-soft">Recipe</p>
          <p className="whitespace-pre-wrap text-sm text-ink">{meal.recipeText}</p>
        </div>
      )}

      <Button full onClick={() => setLogging(true)}>
        Log this meal
      </Button>

      <LogMealSheet open={logging} meal={meal} onClose={() => setLogging(false)} />
    </Screen>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { MacroLine } from '@/components/MacroBits'
import { NumberField } from '@/components/NumberField'
import { Screen } from '@/components/Screen'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { useIngredientMap, useMeal } from '@/db/queries'
import { addMeal, deleteMeal, updateMeal } from '@/db/repo'
import type { MealItem } from '@/db/types'
import { fmtKcal, itemMacros, sumMacros } from '@/lib/macros'
import { IngredientPicker } from './IngredientPicker'

export function MealBuilderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const existing = useMeal(id ?? null)
  const byId = useIngredientMap()

  const [name, setName] = useState('')
  const [servings, setServings] = useState(1)
  const [recipeText, setRecipeText] = useState('')
  const [items, setItems] = useState<MealItem[]>([])
  const [adding, setAdding] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (loaded) return
    if (!id) {
      setLoaded(true)
      return
    }
    if (existing) {
      setName(existing.name)
      setServings(existing.servings)
      setRecipeText(existing.recipeText)
      setItems(existing.items)
      setLoaded(true)
    }
  }, [id, existing, loaded])

  const totals = useMemo(() => {
    if (!byId) return { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    return sumMacros(items.map((it) => itemMacros(it, byId)))
  }, [items, byId])

  function setGrams(idx: number, grams: number) {
    setItems((cur) => cur.map((it, i) => (i === idx ? { ...it, grams } : it)))
  }
  function removeItem(idx: number) {
    setItems((cur) => cur.filter((_, i) => i !== idx))
  }

  async function save() {
    if (!name.trim()) {
      toast('Give the meal a name')
      return
    }
    const input = { name, items, servings, recipeText }
    if (id) {
      await updateMeal(id, input)
      toast('Saved')
      navigate(`/meals/${id}`)
    } else {
      const newIdVal = await addMeal(input)
      toast('Meal saved')
      navigate(`/meals/${newIdVal}`, { replace: true })
    }
  }

  return (
    <Screen title={id ? 'Edit meal' : 'New meal'} back={id ? `/meals/${id}` : '/meals'}>
      <label className="flex flex-col gap-1">
        <span className="text-[0.7rem] font-bold text-ink-soft">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Chicken & rice bowl"
          className="rounded-2xl bg-surface-2 px-3 py-2.5 font-bold text-ink outline-none placeholder:text-ink-faint"
        />
      </label>

      <div className="flex flex-col gap-2">
        {items.map((it, idx) => {
          const ing = byId?.get(it.ingredientId)
          const m = byId ? itemMacros(it, byId) : { kcal: 0, protein: 0, carbs: 0, fat: 0 }
          return (
            <div key={idx} className="rounded-2xl bg-surface p-3 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-semibold text-ink">
                  {ing?.name ?? 'Deleted ingredient'}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="shrink-0 text-xs font-bold text-over"
                >
                  Remove
                </button>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <NumberField value={it.grams} onChange={(g) => setGrams(idx, g)} suffix="g" className="w-28" />
                <div className="text-sm">
                  <div className="font-bold text-ink">{fmtKcal(m.kcal)} kcal</div>
                  <MacroLine macros={m} />
                </div>
              </div>
            </div>
          )
        })}
        <Button variant="soft" full onClick={() => setAdding(true)}>
          + Add ingredient
        </Button>
      </div>

      <div className="rounded-2xl bg-surface p-4 shadow-card">
        <div className="text-lg font-extrabold text-ink">{fmtKcal(totals.kcal)} kcal total</div>
        <MacroLine macros={totals} className="mt-0.5" />
        {servings > 1 && (
          <div className="mt-1 text-xs text-ink-faint">
            {fmtKcal(totals.kcal / servings)} kcal per serving
          </div>
        )}
      </div>

      <div className="grid grid-cols-[7rem_1fr] items-end gap-3">
        <NumberField label="Servings" value={servings} onChange={(n) => setServings(Math.max(1, Math.round(n)))} />
        <p className="pb-3 text-xs text-ink-faint">How many portions the whole recipe makes.</p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[0.7rem] font-bold text-ink-soft">Recipe notes (optional)</span>
        <textarea
          value={recipeText}
          onChange={(e) => setRecipeText(e.target.value)}
          rows={4}
          placeholder="Steps, oven temp, tweaks…"
          className="rounded-2xl bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint"
        />
      </label>

      <Button full onClick={save}>
        Save meal
      </Button>
      {id && (
        <Button full variant="danger" onClick={() => setConfirmDel(true)}>
          Delete meal
        </Button>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add ingredient">
        <IngredientPicker
          onPick={(ing) => {
            setItems((cur) => [...cur, { ingredientId: ing.id, grams: ing.pieceGrams ?? 100 }])
            setAdding(false)
          }}
        />
      </Sheet>

      <ConfirmDialog
        open={confirmDel}
        title="Delete this meal?"
        message="The saved recipe is removed. Past log entries stay."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (id) await deleteMeal(id)
          setConfirmDel(false)
          navigate('/meals')
        }}
        onCancel={() => setConfirmDel(false)}
      />
    </Screen>
  )
}

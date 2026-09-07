import { useState } from 'react'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { MacroLine } from '@/components/MacroBits'
import { NumberField } from '@/components/NumberField'
import { Segmented } from '@/components/Segmented'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { useIngredientMap, useMeals, useQuickMeals } from '@/db/queries'
import { addLogEntry, addQuickMeal, touchQuickMeal } from '@/db/repo'
import type { Ingredient, Meal, QuickMeal } from '@/db/types'
import { fmtKcal, macrosForGrams, mealTotals, sumMacros } from '@/lib/macros'
import { AmountField } from '@/features/meals/AmountField'
import { IngredientPicker } from '@/features/meals/IngredientPicker'
import { LogMealSheet } from '@/features/meals/LogMealSheet'

interface AddEntrySheetProps {
  open: boolean
  onClose: () => void
  profileId: string
  date: string
}

type Tab = 'food' | 'meal' | 'quick'

export function AddEntrySheet({ open, onClose, profileId, date }: AddEntrySheetProps) {
  const [tab, setTab] = useState<Tab>('food')
  const [logMeal, setLogMeal] = useState<Meal | null>(null)

  function close() {
    setTab('food')
    onClose()
  }

  return (
    <>
      <Sheet open={open} onClose={close} title="Add entry">
        <div className="flex flex-col gap-4">
          <Segmented
            options={[
              { value: 'food', label: 'Food' },
              { value: 'meal', label: 'Meal' },
              { value: 'quick', label: 'Quick' },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === 'food' && <FoodTab profileId={profileId} date={date} onDone={close} />}

          {tab === 'meal' && <MealList onPick={(m) => setLogMeal(m)} />}

          {tab === 'quick' && <QuickTab profileId={profileId} date={date} onDone={close} />}
        </div>
      </Sheet>

      {logMeal && (
        <LogMealSheet
          open={!!logMeal}
          meal={logMeal}
          onClose={() => setLogMeal(null)}
          onLogged={() => {
            setLogMeal(null)
            close()
          }}
        />
      )}
    </>
  )
}

/* ------------------------------- food tab ------------------------------ */

interface CartItem {
  ing: Ingredient
  grams: number
}

function FoodTab({
  profileId,
  date,
  onDone,
}: {
  profileId: string
  date: string
  onDone: () => void
}) {
  const toast = useToast()
  const [items, setItems] = useState<CartItem[]>([])
  const [picking, setPicking] = useState<Ingredient | null>(null)
  const [groupName, setGroupName] = useState('')

  if (picking) {
    return (
      <AmountStep
        ingredient={picking}
        onCancel={() => setPicking(null)}
        onAdd={(grams) => {
          setItems((x) => [...x, { ing: picking, grams }])
          setPicking(null)
        }}
      />
    )
  }

  const total = sumMacros(items.map((it) => macrosForGrams(it.ing, it.grams)))
  const name = groupName.trim()

  async function commit() {
    if (items.length === 0) return
    if (name) {
      await addLogEntry({
        profileId,
        date,
        name,
        macros: total,
        source: 'group',
        sourceId: null,
        grams: items.reduce((s, it) => s + it.grams, 0),
      })
    } else {
      for (const it of items) {
        await addLogEntry({
          profileId,
          date,
          name: it.ing.name,
          macros: macrosForGrams(it.ing, it.grams),
          source: 'ingredient',
          sourceId: it.ing.id,
          grams: it.grams,
        })
      }
    }
    toast('Added')
    onDone()
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-ink">
                {it.ing.name} · <span className="text-ink-faint">{it.grams} g</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-bold text-ink-faint">
                  {fmtKcal(macrosForGrams(it.ing, it.grams).kcal)}
                </span>
                <button
                  type="button"
                  onClick={() => setItems((x) => x.filter((_, j) => j !== i))}
                  className="text-xs font-bold text-over"
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
          <div className="mt-1 border-t border-surface-2 pt-2">
            <div className="font-extrabold text-ink">{fmtKcal(total.kcal)} kcal</div>
            <MacroLine macros={total} className="mt-0.5" />
          </div>
          {items.length > 1 && (
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name — e.g. Breakfast (optional)"
              className="mt-1 rounded-xl bg-surface-2 px-3 py-2 text-sm font-bold text-ink outline-none placeholder:text-ink-faint"
            />
          )}
          <Button full onClick={commit}>
            {name
              ? `Log as "${name}"`
              : items.length === 1
                ? `Add ${items[0].ing.name}`
                : `Add ${items.length} items separately`}
          </Button>
        </div>
      )}

      <IngredientPicker onPick={setPicking} />
    </div>
  )
}

function AmountStep({
  ingredient,
  onCancel,
  onAdd,
}: {
  ingredient: Ingredient
  onCancel: () => void
  onAdd: (grams: number) => void
}) {
  const [grams, setGrams] = useState(ingredient.pieceGrams ?? 100)
  const macros = macrosForGrams(ingredient, grams)

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onCancel} className="self-start text-sm font-bold text-ink-soft">
        ‹ Back
      </button>
      <div className="font-bold text-ink">{ingredient.name}</div>
      <AmountField ingredient={ingredient} grams={grams} onChange={setGrams} />
      <div className="rounded-2xl bg-surface p-3">
        <div className="font-extrabold text-ink">{fmtKcal(macros.kcal)} kcal</div>
        <MacroLine macros={macros} className="mt-0.5" />
      </div>
      <Button full onClick={() => grams > 0 && onAdd(grams)}>
        Add to list
      </Button>
    </div>
  )
}

/* ------------------------------- meal tab ------------------------------ */

function MealList({ onPick }: { onPick: (meal: Meal) => void }) {
  const meals = useMeals()
  const byId = useIngredientMap()
  if (!meals || !byId) return null
  if (meals.length === 0)
    return <EmptyState emoji="🥘" title="No saved meals" hint="Build one in the Meals tab first." />

  return (
    <div className="flex flex-col">
      {meals.map((m) => {
        const t = mealTotals(m, byId).macros
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onPick(m)}
            className="flex items-center justify-between gap-3 border-b border-surface-2 py-3 text-left last:border-0 active:opacity-70"
          >
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink">{m.name}</div>
              <MacroLine macros={t} className="mt-0.5" />
            </div>
            <span className="shrink-0 font-bold text-ink-faint">{fmtKcal(t.kcal)}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------ quick tab ----------------------------- */

function QuickTab({
  profileId,
  date,
  onDone,
}: {
  profileId: string
  date: string
  onDone: () => void
}) {
  const toast = useToast()
  const quickMeals = useQuickMeals()
  const [creating, setCreating] = useState(false)

  if (creating) {
    return <QuickEntry profileId={profileId} date={date} onDone={onDone} onCancel={() => setCreating(false)} />
  }

  async function log(q: QuickMeal) {
    await addLogEntry({
      profileId,
      date,
      name: q.name,
      macros: { kcal: q.kcal, protein: q.protein, carbs: q.carbs, fat: q.fat },
      source: 'quick',
      sourceId: q.id,
      grams: null,
    })
    await touchQuickMeal(q.id)
    toast('Added')
    onDone()
  }

  return (
    <div className="flex flex-col gap-3">
      <Button full onClick={() => setCreating(true)}>
        + New quick entry
      </Button>

      {quickMeals && quickMeals.length === 0 ? (
        <EmptyState
          emoji="🥪"
          title="No saved quick meals"
          hint="Add one now, or save it when you create a quick entry."
        />
      ) : (
        <div className="flex flex-col">
          {quickMeals?.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => log(q)}
              className="flex items-center justify-between gap-3 border-b border-surface-2 py-3 text-left last:border-0 active:opacity-70"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-ink">{q.name}</div>
                <MacroLine macros={q} className="mt-0.5" />
              </div>
              <span className="shrink-0 font-bold text-ink-faint">{fmtKcal(q.kcal)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function QuickEntry({
  profileId,
  date,
  onDone,
  onCancel,
}: {
  profileId: string
  date: string
  onDone: () => void
  onCancel: () => void
}) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState(0)
  const [protein, setProtein] = useState(0)
  const [carbs, setCarbs] = useState(0)
  const [fat, setFat] = useState(0)
  const [save, setSave] = useState(true)

  async function add() {
    const macros = { kcal, protein, carbs, fat }
    await addLogEntry({
      profileId,
      date,
      name: name.trim() || 'Quick entry',
      macros,
      source: 'quick',
      sourceId: null,
      grams: null,
    })
    if (save && name.trim()) await addQuickMeal({ name, ...macros })
    toast('Added')
    onDone()
  }

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onCancel} className="self-start text-sm font-bold text-ink-soft">
        ‹ Back
      </button>
      <label className="flex flex-col gap-1">
        <span className="text-[0.7rem] font-bold text-ink-soft">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Deli chicken sandwich"
          className="rounded-2xl bg-surface-2 px-3 py-2.5 font-bold text-ink outline-none placeholder:text-ink-faint"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Calories" value={kcal} onChange={setKcal} suffix="kcal" />
        <NumberField label="Protein" value={protein} onChange={setProtein} suffix="g" />
        <NumberField label="Carbs" value={carbs} onChange={setCarbs} suffix="g" />
        <NumberField label="Fat" value={fat} onChange={setFat} suffix="g" />
      </div>
      <label className="flex items-center gap-2 px-1 text-sm font-semibold text-ink-soft">
        <input
          type="checkbox"
          checked={save}
          onChange={(e) => setSave(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        Save to Quick meals for next time
      </label>
      <Button full onClick={add}>
        Add
      </Button>
    </div>
  )
}

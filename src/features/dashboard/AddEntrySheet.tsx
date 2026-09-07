import { useState } from 'react'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { MacroLine } from '@/components/MacroBits'
import { NumberField } from '@/components/NumberField'
import { Segmented } from '@/components/Segmented'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { useIngredientMap, useMeals } from '@/db/queries'
import { addLogEntry } from '@/db/repo'
import type { Ingredient, Meal } from '@/db/types'
import { fmtKcal, macrosForGrams, mealTotals } from '@/lib/macros'
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
  const [picked, setPicked] = useState<Ingredient | null>(null)
  const [logMeal, setLogMeal] = useState<Meal | null>(null)

  function close() {
    setPicked(null)
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
            onChange={(t) => {
              setTab(t)
              setPicked(null)
            }}
          />

          {tab === 'food' &&
            (picked ? (
              <FoodAmount
                ingredient={picked}
                profileId={profileId}
                date={date}
                onBack={() => setPicked(null)}
                onDone={close}
              />
            ) : (
              <IngredientPicker onPick={setPicked} />
            ))}

          {tab === 'meal' && (
            <MealList
              onPick={(m) => {
                setLogMeal(m)
              }}
            />
          )}

          {tab === 'quick' && <QuickEntry profileId={profileId} date={date} onDone={close} />}
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

function FoodAmount({
  ingredient,
  profileId,
  date,
  onBack,
  onDone,
}: {
  ingredient: Ingredient
  profileId: string
  date: string
  onBack: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [grams, setGrams] = useState(ingredient.pieceGrams ?? 100)
  const macros = macrosForGrams(ingredient, grams)

  async function add() {
    await addLogEntry({
      profileId,
      date,
      name: ingredient.name,
      macros,
      source: 'ingredient',
      sourceId: ingredient.id,
      grams,
    })
    toast('Added')
    onDone()
  }

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onBack} className="self-start text-sm font-bold text-ink-soft">
        ‹ Back
      </button>
      <div className="font-bold text-ink">{ingredient.name}</div>
      <AmountField ingredient={ingredient} grams={grams} onChange={setGrams} />
      <div className="rounded-2xl bg-surface p-3">
        <div className="font-extrabold text-ink">{fmtKcal(macros.kcal)} kcal</div>
        <MacroLine macros={macros} className="mt-0.5" />
      </div>
      <Button full onClick={add}>
        Add
      </Button>
    </div>
  )
}

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

function QuickEntry({
  profileId,
  date,
  onDone,
}: {
  profileId: string
  date: string
  onDone: () => void
}) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState(0)
  const [protein, setProtein] = useState(0)
  const [carbs, setCarbs] = useState(0)
  const [fat, setFat] = useState(0)

  async function add() {
    await addLogEntry({
      profileId,
      date,
      name: name || 'Quick entry',
      macros: { kcal, protein, carbs, fat },
      source: 'quick',
      sourceId: null,
      grams: null,
    })
    toast('Added')
    onDone()
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-[0.7rem] font-bold text-ink-soft">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Restaurant lunch"
          className="rounded-2xl bg-surface-2 px-3 py-2.5 font-bold text-ink outline-none placeholder:text-ink-faint"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Calories" value={kcal} onChange={setKcal} suffix="kcal" />
        <NumberField label="Protein" value={protein} onChange={setProtein} suffix="g" />
        <NumberField label="Carbs" value={carbs} onChange={setCarbs} suffix="g" />
        <NumberField label="Fat" value={fat} onChange={setFat} suffix="g" />
      </div>
      <Button full onClick={add}>
        Add
      </Button>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { MacroLine } from '@/components/MacroBits'
import { NumberField } from '@/components/NumberField'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { deleteLogEntry, updateLogEntry } from '@/db/repo'
import type { GroupItem, Ingredient, LogEntry } from '@/db/types'
import { newId } from '@/lib/id'
import { fmtKcal, roundMacros, scaleMacros, sumMacros, type Macros } from '@/lib/macros'
import { AmountField } from '@/features/meals/AmountField'
import { IngredientPicker } from '@/features/meals/IngredientPicker'

interface Row {
  key: string
  ingredientId: string | null
  name: string
  grams: number
  /** macros per 1 g — lets grams change without snapshot drift */
  per: Macros
}

function rowFromItem(it: GroupItem): Row {
  const g = it.grams > 0 ? it.grams : 1
  return {
    key: newId(),
    ingredientId: it.ingredientId,
    name: it.name,
    grams: it.grams,
    per: { kcal: it.kcal / g, protein: it.protein / g, carbs: it.carbs / g, fat: it.fat / g },
  }
}

const rowMacros = (r: Row): Macros => scaleMacros(r.per, r.grams)

export function GroupEntrySheet({ entry, onClose }: { entry: LogEntry; onClose: () => void }) {
  const toast = useToast()
  const [name, setName] = useState(entry.name)
  const [rows, setRows] = useState<Row[]>(() => (entry.items ?? []).map(rowFromItem))
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<Ingredient | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  const total = useMemo(() => roundMacros(sumMacros(rows.map(rowMacros))), [rows])

  function addRow(ing: Ingredient, grams: number) {
    setRows((rs) => [
      ...rs,
      {
        key: newId(),
        ingredientId: ing.id,
        name: ing.name,
        grams,
        per: scaleMacros({ kcal: ing.kcal, protein: ing.protein, carbs: ing.carbs, fat: ing.fat }, 1 / 100),
      },
    ])
    setPicked(null)
    setAdding(false)
  }

  async function save() {
    if (rows.length === 0) {
      toast('Add an item, or delete the entry')
      return
    }
    const items: GroupItem[] = rows.map((r) => ({
      ingredientId: r.ingredientId,
      name: r.name,
      grams: r.grams,
      ...roundMacros(rowMacros(r)),
    }))
    await updateLogEntry(entry.id, {
      name,
      items,
      macros: sumMacros(rows.map(rowMacros)),
      grams: rows.reduce((s, r) => s + r.grams, 0),
    })
    toast('Saved')
    onClose()
  }

  async function doDelete() {
    await deleteLogEntry(entry.id)
    setConfirmDel(false)
    toast('Deleted')
    onClose()
  }

  // ---- add-an-ingredient sub-flow -------------------------------------
  if (adding) {
    return (
      <Sheet open onClose={() => setAdding(false)} title="Add ingredient">
        {picked ? (
          <AddAmount ingredient={picked} onBack={() => setPicked(null)} onAdd={addRow} />
        ) : (
          <>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="mb-2 text-sm font-bold text-ink-soft"
            >
              ‹ Back
            </button>
            <IngredientPicker onPick={setPicked} />
          </>
        )}
      </Sheet>
    )
  }

  return (
    <Sheet open onClose={onClose} title="Edit group">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] font-bold text-ink-soft">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-2xl bg-surface-2 px-3 py-2.5 font-bold text-ink outline-none"
          />
        </label>

        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.key} className="rounded-2xl bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-semibold text-ink">{r.name}</span>
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  className="shrink-0 text-xs font-bold text-over"
                >
                  Remove
                </button>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <NumberField
                  className="w-28"
                  value={r.grams}
                  onChange={(g) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, grams: g } : x)))}
                  suffix="g"
                />
                <span className="text-xs text-ink-faint">
                  {fmtKcal(rowMacros(r).kcal)} kcal · <MacroLine macros={rowMacros(r)} />
                </span>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="py-3 text-center text-sm text-ink-faint">No items — add one below.</p>
          )}
        </div>

        <Button variant="soft" full onClick={() => setAdding(true)}>
          + Add ingredient
        </Button>

        <div className="rounded-2xl bg-surface p-3">
          <div className="font-extrabold text-ink">{fmtKcal(total.kcal)} kcal</div>
          <MacroLine macros={total} className="mt-0.5" />
        </div>

        <Button full onClick={save}>
          Save
        </Button>
        <Button full variant="danger" onClick={() => setConfirmDel(true)}>
          Delete entry
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDel}
        title="Delete this entry?"
        message="Removes the whole group from this day."
        confirmLabel="Delete"
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirmDel(false)}
      />
    </Sheet>
  )
}

function AddAmount({
  ingredient,
  onBack,
  onAdd,
}: {
  ingredient: Ingredient
  onBack: () => void
  onAdd: (ing: Ingredient, grams: number) => void
}) {
  const [grams, setGrams] = useState(ingredient.pieceGrams ?? 100)
  const macros = scaleMacros(
    { kcal: ingredient.kcal, protein: ingredient.protein, carbs: ingredient.carbs, fat: ingredient.fat },
    grams / 100,
  )

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
      <Button full onClick={() => grams > 0 && onAdd(ingredient, grams)}>
        Add to group
      </Button>
    </div>
  )
}

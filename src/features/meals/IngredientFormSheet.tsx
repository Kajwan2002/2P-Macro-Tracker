import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { NumberField } from '@/components/NumberField'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { addIngredient, deleteIngredient, ingredientUsage, updateIngredient } from '@/db/repo'
import type { Ingredient } from '@/db/types'

interface IngredientFormSheetProps {
  open: boolean
  onClose: () => void
  /** null = create a new ingredient */
  ingredient: Ingredient | null
}

export function IngredientFormSheet({ open, onClose, ingredient }: IngredientFormSheetProps) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState(0)
  const [protein, setProtein] = useState(0)
  const [carbs, setCarbs] = useState(0)
  const [fat, setFat] = useState(0)
  const [pieceGrams, setPieceGrams] = useState(0)
  const [pieceLabel, setPieceLabel] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const [usage, setUsage] = useState(0)

  useEffect(() => {
    if (!open) return
    setName(ingredient?.name ?? '')
    setKcal(ingredient?.kcal ?? 0)
    setProtein(ingredient?.protein ?? 0)
    setCarbs(ingredient?.carbs ?? 0)
    setFat(ingredient?.fat ?? 0)
    setPieceGrams(ingredient?.pieceGrams ?? 0)
    setPieceLabel(ingredient?.pieceLabel ?? '')
  }, [open, ingredient])

  async function save() {
    const input = {
      name,
      kcal,
      protein,
      carbs,
      fat,
      pieceGrams: pieceGrams > 0 ? pieceGrams : null,
      pieceLabel,
    }
    if (ingredient) await updateIngredient(ingredient.id, input)
    else await addIngredient(input)
    toast('Saved')
    onClose()
  }

  async function askDelete() {
    if (!ingredient) return
    setUsage(await ingredientUsage(ingredient.id))
    setConfirmDel(true)
  }

  async function doDelete() {
    if (!ingredient) return
    await deleteIngredient(ingredient.id)
    setConfirmDel(false)
    toast('Deleted')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={ingredient ? 'Edit ingredient' : 'New ingredient'}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] font-bold text-ink-soft">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Chicken breast"
            className="rounded-2xl bg-surface-2 px-3 py-2.5 font-bold text-ink outline-none placeholder:text-ink-faint"
          />
        </label>

        <div>
          <p className="mb-1 px-1 text-[0.7rem] font-bold text-ink-soft">Per 100 g</p>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Calories" value={kcal} onChange={setKcal} suffix="kcal" />
            <NumberField label="Protein" value={protein} onChange={setProtein} suffix="g" />
            <NumberField label="Carbs" value={carbs} onChange={setCarbs} suffix="g" />
            <NumberField label="Fat" value={fat} onChange={setFat} suffix="g" />
          </div>
        </div>

        <div>
          <p className="mb-1 px-1 text-[0.7rem] font-bold text-ink-soft">
            Piece unit (optional) — log by "1 egg", "1 slice"…
          </p>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Grams per piece" value={pieceGrams} onChange={setPieceGrams} suffix="g" />
            <label className="flex flex-col gap-1">
              <span className="text-[0.7rem] font-bold text-ink-soft">Piece name</span>
              <input
                value={pieceLabel}
                onChange={(e) => setPieceLabel(e.target.value)}
                placeholder="egg"
                className="rounded-2xl bg-surface-2 px-3 py-2.5 font-bold text-ink outline-none placeholder:text-ink-faint"
              />
            </label>
          </div>
        </div>

        <Button full onClick={save}>
          Save
        </Button>
        {ingredient && (
          <Button full variant="danger" onClick={askDelete}>
            Delete
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDel}
        title="Delete ingredient?"
        message={
          usage > 0
            ? `Used in ${usage} saved meal${usage > 1 ? 's' : ''}. Those meals will count it as 0 until you edit them.`
            : 'This cannot be undone.'
        }
        confirmLabel="Delete"
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirmDel(false)}
      />
    </Sheet>
  )
}

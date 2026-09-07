import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { NumberField } from '@/components/NumberField'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { addQuickMeal, deleteQuickMeal, updateQuickMeal } from '@/db/repo'
import type { QuickMeal } from '@/db/types'

interface QuickMealFormSheetProps {
  open: boolean
  onClose: () => void
  /** null = create a new quick meal */
  quickMeal: QuickMeal | null
}

export function QuickMealFormSheet({ open, onClose, quickMeal }: QuickMealFormSheetProps) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState(0)
  const [protein, setProtein] = useState(0)
  const [carbs, setCarbs] = useState(0)
  const [fat, setFat] = useState(0)
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(quickMeal?.name ?? '')
    setKcal(quickMeal?.kcal ?? 0)
    setProtein(quickMeal?.protein ?? 0)
    setCarbs(quickMeal?.carbs ?? 0)
    setFat(quickMeal?.fat ?? 0)
  }, [open, quickMeal])

  async function save() {
    const input = { name, kcal, protein, carbs, fat }
    if (quickMeal) await updateQuickMeal(quickMeal.id, input)
    else await addQuickMeal(input)
    toast('Saved')
    onClose()
  }

  async function doDelete() {
    if (!quickMeal) return
    await deleteQuickMeal(quickMeal.id)
    setConfirmDel(false)
    toast('Deleted')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={quickMeal ? 'Edit quick meal' : 'New quick meal'}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] font-bold text-ink-soft">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Deli chicken sandwich"
            className="rounded-2xl bg-surface-2 px-3 py-2.5 font-bold text-ink outline-none placeholder:text-ink-faint"
          />
        </label>

        <div>
          <p className="mb-1 px-1 text-[0.7rem] font-bold text-ink-soft">Macros per serving</p>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Calories" value={kcal} onChange={setKcal} suffix="kcal" />
            <NumberField label="Protein" value={protein} onChange={setProtein} suffix="g" />
            <NumberField label="Carbs" value={carbs} onChange={setCarbs} suffix="g" />
            <NumberField label="Fat" value={fat} onChange={setFat} suffix="g" />
          </div>
        </div>

        <Button full onClick={save}>
          Save
        </Button>
        {quickMeal && (
          <Button full variant="danger" onClick={() => setConfirmDel(true)}>
            Delete
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDel}
        title="Delete quick meal?"
        message="This won't change anything you've already logged."
        confirmLabel="Delete"
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirmDel(false)}
      />
    </Sheet>
  )
}

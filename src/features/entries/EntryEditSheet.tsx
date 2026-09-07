import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { NumberField } from '@/components/NumberField'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { deleteLogEntry, updateLogEntry } from '@/db/repo'
import type { LogEntry } from '@/db/types'
import { GroupEntrySheet } from './GroupEntrySheet'

interface EntryEditSheetProps {
  entry: LogEntry | null
  onClose: () => void
}

export function EntryEditSheet({ entry, onClose }: EntryEditSheetProps) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState(0)
  const [protein, setProtein] = useState(0)
  const [carbs, setCarbs] = useState(0)
  const [fat, setFat] = useState(0)

  useEffect(() => {
    if (!entry) return
    setName(entry.name)
    setKcal(entry.kcal)
    setProtein(entry.protein)
    setCarbs(entry.carbs)
    setFat(entry.fat)
  }, [entry])

  if (!entry) return null

  if (entry.source === 'group' && entry.items && entry.items.length > 0) {
    return <GroupEntrySheet entry={entry} onClose={onClose} />
  }

  async function save() {
    await updateLogEntry(entry!.id, {
      name,
      macros: { kcal, protein, carbs, fat },
      grams: null,
    })
    toast('Saved')
    onClose()
  }

  async function remove() {
    await deleteLogEntry(entry!.id)
    toast('Deleted')
    onClose()
  }

  return (
    <Sheet open={!!entry} onClose={onClose} title="Edit entry">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] font-bold text-ink-soft">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-2xl bg-surface-2 px-3 py-2.5 font-bold text-ink outline-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Calories" value={kcal} onChange={setKcal} suffix="kcal" />
          <NumberField label="Protein" value={protein} onChange={setProtein} suffix="g" />
          <NumberField label="Carbs" value={carbs} onChange={setCarbs} suffix="g" />
          <NumberField label="Fat" value={fat} onChange={setFat} suffix="g" />
        </div>

        {entry.mealEventId && (
          <p className="rounded-2xl bg-surface px-4 py-3 text-xs text-ink-faint">
            Part of a shared meal. Editing here changes only this portion.
          </p>
        )}

        <Button full onClick={save}>
          Save
        </Button>
        <Button full variant="danger" onClick={remove}>
          Delete entry
        </Button>
      </div>
    </Sheet>
  )
}

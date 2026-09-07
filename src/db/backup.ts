import { format } from 'date-fns'
import { db, requestPersistentStorage } from './db'
import { updateSettings } from './repo'
import type {
  Ingredient,
  LogEntry,
  Meal,
  MealEvent,
  Profile,
  Settings,
  WeightEntry,
} from './types'

const BACKUP_VERSION = 1

export interface BackupFile {
  app: 'macro-tracker'
  version: number
  exportedAt: string
  data: {
    profiles: Profile[]
    ingredients: Ingredient[]
    meals: Meal[]
    logEntries: LogEntry[]
    mealEvents: MealEvent[]
    weights: WeightEntry[]
    settings: Settings[]
  }
}

export async function buildBackup(): Promise<BackupFile> {
  const [profiles, ingredients, meals, logEntries, mealEvents, weights, settings] =
    await Promise.all([
      db.profiles.toArray(),
      db.ingredients.toArray(),
      db.meals.toArray(),
      db.logEntries.toArray(),
      db.mealEvents.toArray(),
      db.weights.toArray(),
      db.settings.toArray(),
    ])
  return {
    app: 'macro-tracker',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { profiles, ingredients, meals, logEntries, mealEvents, weights, settings },
  }
}

function backupFilename(): string {
  return `macro-tracker-backup-${format(new Date(), 'yyyy-MM-dd')}.json`
}

/** On iOS this offers the share sheet ("Save to Files"); elsewhere it downloads. */
export async function exportBackup(): Promise<'shared' | 'downloaded'> {
  const json = JSON.stringify(await buildBackup(), null, 2)
  const filename = backupFilename()
  const file = new File([json], filename, { type: 'application/json' })

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Macro Tracker backup' })
      await updateSettings({ lastBackupAt: Date.now() })
      return 'shared'
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
    }
  }

  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  await updateSettings({ lastBackupAt: Date.now() })
  return 'downloaded'
}

function isBackup(v: unknown): v is BackupFile {
  if (!v || typeof v !== 'object') return false
  const b = v as Record<string, unknown>
  return b.app === 'macro-tracker' && typeof b.version === 'number' && !!b.data
}

export interface ImportResult {
  profiles: number
  logEntries: number
  meals: number
}

/** Replace all local data with the contents of a backup file. */
export async function importBackup(text: string): Promise<ImportResult> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (!isBackup(parsed)) throw new Error('That doesn’t look like a Macro Tracker backup.')

  const { profiles, ingredients, meals, logEntries, mealEvents, weights, settings } = parsed.data

  await db.transaction(
    'rw',
    [db.profiles, db.ingredients, db.meals, db.logEntries, db.mealEvents, db.weights, db.settings],
    async () => {
      await Promise.all([
        db.profiles.clear(),
        db.ingredients.clear(),
        db.meals.clear(),
        db.logEntries.clear(),
        db.mealEvents.clear(),
        db.weights.clear(),
        db.settings.clear(),
      ])
      if (profiles?.length) await db.profiles.bulkAdd(profiles)
      if (ingredients?.length) await db.ingredients.bulkAdd(ingredients)
      if (meals?.length) await db.meals.bulkAdd(meals)
      if (logEntries?.length) await db.logEntries.bulkAdd(logEntries)
      if (mealEvents?.length) await db.mealEvents.bulkAdd(mealEvents)
      if (weights?.length) await db.weights.bulkAdd(weights)
      if (settings?.length) await db.settings.bulkAdd(settings)
    },
  )

  return {
    profiles: profiles?.length ?? 0,
    logEntries: logEntries?.length ?? 0,
    meals: meals?.length ?? 0,
  }
}

/** Wipe everything; the next startup re-seeds from scratch. */
export async function wipeAll(): Promise<void> {
  await db.transaction(
    'rw',
    [db.profiles, db.ingredients, db.meals, db.logEntries, db.mealEvents, db.weights, db.settings],
    async () => {
      await Promise.all([
        db.profiles.clear(),
        db.ingredients.clear(),
        db.meals.clear(),
        db.logEntries.clear(),
        db.mealEvents.clear(),
        db.weights.clear(),
        db.settings.clear(),
      ])
    },
  )
  void requestPersistentStorage()
}

import { useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { Card, SectionTitle } from '@/components/Card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Screen } from '@/components/Screen'
import { useToast } from '@/components/Toast'
import { exportBackup, importBackup, wipeAll } from '@/db/backup'
import { useProfiles, useSettings } from '@/db/queries'
import type { Profile } from '@/db/types'
import { shortDate } from '@/lib/dates'
import { accentById } from '@/theme/accents'
import { ProfileFormSheet } from './ProfileFormSheet'

export function SettingsPage() {
  const toast = useToast()
  const profiles = useProfiles()
  const settings = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  async function onImportFile(file: File) {
    try {
      const res = await importBackup(await file.text())
      toast(`Restored ${res.logEntries} entries`)
    } catch (err) {
      toast((err as Error).message)
    }
  }

  return (
    <Screen title="Settings">
      <SectionTitle>Profiles</SectionTitle>
      <Card className="flex flex-col gap-2">
        {profiles?.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setEditing(p)}
            className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3 text-left active:opacity-80"
          >
            <span className="flex items-center gap-3">
              <span
                className="h-6 w-6 rounded-full"
                style={{ background: accentById(p.accent).base }}
              />
              <span className="font-bold text-ink">{p.name}</span>
            </span>
            <span className="text-xs font-semibold text-ink-faint">
              {p.kcalTarget} kcal · {p.proteinTarget} g P
            </span>
          </button>
        ))}
        <Button variant="soft" full onClick={() => setCreating(true)}>
          + Add profile
        </Button>
      </Card>

      <SectionTitle>Backup</SectionTitle>
      <Card className="flex flex-col gap-2">
        <p className="px-1 text-xs text-ink-faint">
          All data is stored only on this device. Export a file to keep it safe or move it to another
          phone.
          {settings?.lastBackupAt
            ? ` Last export ${shortDate(new Date(settings.lastBackupAt).toISOString().slice(0, 10))}.`
            : ''}
        </p>
        <Button
          variant="soft"
          full
          onClick={async () => {
            try {
              await exportBackup()
            } catch {
              /* user cancelled share */
            }
          }}
        >
          Export backup
        </Button>
        <Button variant="soft" full onClick={() => fileRef.current?.click()}>
          Import backup
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onImportFile(f)
            e.target.value = ''
          }}
        />
        <Button variant="danger" full onClick={() => setConfirmReset(true)}>
          Reset all data
        </Button>
      </Card>

      <SectionTitle>About</SectionTitle>
      <Card>
        <p className="text-sm text-ink-soft">
          Macro Tracker — a private, offline calorie & protein tracker for two. Add it to your home
          screen to use it like an app.
        </p>
      </Card>

      <ProfileFormSheet open={creating} onClose={() => setCreating(false)} profile={null} />
      <ProfileFormSheet open={!!editing} onClose={() => setEditing(null)} profile={editing} />

      <ConfirmDialog
        open={confirmReset}
        title="Reset everything?"
        message="Deletes all profiles, meals, ingredients and history on this device. The app re-seeds with defaults."
        confirmLabel="Reset"
        danger
        onConfirm={async () => {
          await wipeAll()
          location.reload()
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </Screen>
  )
}

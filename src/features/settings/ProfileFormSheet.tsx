import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { NumberField } from '@/components/NumberField'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { useMaintenanceEstimate, useProfiles, useWeights } from '@/db/queries'
import { addProfile, deleteProfile, updateProfile } from '@/db/repo'
import type { Profile } from '@/db/types'
import { fmtKcal, round1 } from '@/lib/macros'
import { ACCENTS } from '@/theme/accents'

interface ProfileFormSheetProps {
  open: boolean
  onClose: () => void
  /** null = create new */
  profile: Profile | null
}

export function ProfileFormSheet({ open, onClose, profile }: ProfileFormSheetProps) {
  const toast = useToast()
  const profiles = useProfiles()
  const [name, setName] = useState('')
  const [accent, setAccent] = useState('mint')
  const [kcal, setKcal] = useState(2200)
  const [protein, setProtein] = useState(150)
  const [carbs, setCarbs] = useState(220)
  const [fat, setFat] = useState(70)
  const [maintenance, setMaintenance] = useState(0)
  const [goal, setGoal] = useState(0)
  const [coachOn, setCoachOn] = useState(false)
  const weights = useWeights(profile?.id)
  const latestKg = weights?.length ? weights[weights.length - 1].kg : null
  const estimate = useMaintenanceEstimate(profile?.id)
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(profile?.name ?? '')
    setAccent(profile?.accent ?? 'mint')
    setKcal(profile?.kcalTarget ?? 2200)
    setProtein(profile?.proteinTarget ?? 150)
    setCarbs(profile?.carbsTarget ?? 220)
    setFat(profile?.fatTarget ?? 70)
    setMaintenance(profile?.maintenanceKcal ?? 0)
    setGoal(profile?.goalKgPerWeek ?? 0)
    setCoachOn(profile?.goalKgPerWeek != null)
  }, [open, profile])

  async function save() {
    const input = {
      name,
      accent,
      kcalTarget: kcal,
      proteinTarget: protein,
      carbsTarget: carbs,
      fatTarget: fat,
      maintenanceKcal: maintenance || null,
      goalKgPerWeek: coachOn ? goal : null,
    }
    if (profile) await updateProfile(profile.id, input)
    else await addProfile(input)
    toast('Saved')
    onClose()
  }

  const canDelete = profile && (profiles?.length ?? 0) > 1

  return (
    <Sheet open={open} onClose={onClose} title={profile ? 'Edit profile' : 'New profile'}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] font-bold text-ink-soft">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-2xl bg-surface-2 px-3 py-2.5 font-bold text-ink outline-none"
          />
        </label>

        <div>
          <p className="mb-1.5 px-1 text-[0.7rem] font-bold text-ink-soft">Colour</p>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-label={a.name}
                onClick={() => setAccent(a.id)}
                className="h-9 w-9 rounded-full border-2 transition"
                style={{
                  background: a.base,
                  borderColor: accent === a.id ? 'var(--color-ink)' : 'transparent',
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 px-1 text-[0.7rem] font-bold text-ink-soft">Daily targets</p>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Calories" value={kcal} onChange={setKcal} suffix="kcal" />
            <NumberField label="Protein" value={protein} onChange={setProtein} suffix="g" />
            <NumberField label="Carbs" value={carbs} onChange={setCarbs} suffix="g" />
            <NumberField label="Fat" value={fat} onChange={setFat} suffix="g" />
          </div>
        </div>

        <div>
          <p className="mb-1 px-1 text-[0.7rem] font-bold text-ink-soft">Maintenance</p>
          <NumberField
            label="Calories you burn per day"
            value={maintenance}
            onChange={setMaintenance}
            placeholder="optional"
            suffix="kcal"
          />
          <p className="mt-1.5 px-1 text-xs text-ink-faint">
            History's weekly balance uses this to show your real surplus or deficit.
            {estimate ? (
              <>
                {' '}
                From your last 4 weeks of food and weight: ≈{' '}
                <span className="font-bold text-ink">{fmtKcal(estimate)}</span>.{' '}
                <button
                  type="button"
                  onClick={() => setMaintenance(estimate)}
                  className="font-bold text-accent"
                >
                  Use it
                </button>
              </>
            ) : (
              ' Log food and weigh in for 2+ weeks and the app will estimate it for you.'
            )}
          </p>
        </div>

        <div>
          <label className="mb-1 flex items-center justify-between gap-2 px-1">
            <span className="text-[0.7rem] font-bold text-ink-soft">Coach</span>
            <input
              type="checkbox"
              checked={coachOn}
              onChange={(e) => setCoachOn(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
          </label>
          {coachOn ? (
            <>
              <NumberField
                label="Goal: lose per week (0 = maintain)"
                value={goal}
                onChange={setGoal}
                placeholder="0.5"
                suffix="kg"
              />
              <p className="mt-1.5 px-1 text-xs text-ink-faint">
                A good pace is 0.5–1% of body weight per week
                {latestKg ? ` — ${round1(latestKg * 0.005)}–${round1(latestKg * 0.01)} kg for you` : ''}.
                The Today screen will check your progress and suggest target changes.
              </p>
            </>
          ) : (
            <p className="px-1 text-xs text-ink-faint">
              Turn on to set a weekly goal and get target suggestions as your body changes.
            </p>
          )}
        </div>

        <Button full onClick={save}>
          Save
        </Button>
        {canDelete && (
          <Button full variant="danger" onClick={() => setConfirmDel(true)}>
            Delete profile
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDel}
        title={`Delete ${profile?.name}?`}
        message="Every logged day and weight entry for this profile is removed. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          try {
            if (profile) await deleteProfile(profile.id)
            setConfirmDel(false)
            toast('Profile deleted')
            onClose()
          } catch (err) {
            toast((err as Error).message)
          }
        }}
        onCancel={() => setConfirmDel(false)}
      />
    </Sheet>
  )
}

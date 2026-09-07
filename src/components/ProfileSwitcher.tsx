import { accentById } from '@/theme/accents'
import { useActiveProfile, useProfiles } from '@/db/queries'
import { setActiveProfile } from '@/db/repo'
import { cn } from '@/lib/cn'

/** Pill row to switch the active profile. Shown on Today and History. */
export function ProfileSwitcher() {
  const profiles = useProfiles()
  const active = useActiveProfile()
  if (!profiles || profiles.length < 2) return null

  return (
    <div className="flex gap-2 rounded-full bg-surface-2 p-1">
      {profiles.map((p) => {
        const on = p.id === active?.id
        const accent = accentById(p.accent).base
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => setActiveProfile(p.id)}
            className={cn(
              'flex-1 truncate rounded-full px-3 py-2 text-sm font-bold transition',
              on ? 'text-bg-deep' : 'text-ink-soft',
            )}
            style={on ? { background: accent } : undefined}
          >
            {p.name}
          </button>
        )
      })}
    </div>
  )
}

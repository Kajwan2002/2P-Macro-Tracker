import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { MacroLine } from '@/components/MacroBits'
import { NumberField } from '@/components/NumberField'
import { Segmented } from '@/components/Segmented'
import { Sheet } from '@/components/Sheet'
import { SplitSlider } from '@/components/SplitSlider'
import { useToast } from '@/components/Toast'
import { useActiveProfile, useIngredientMap, useProfiles } from '@/db/queries'
import { addLogEntry, addMealEvent } from '@/db/repo'
import type { Meal } from '@/db/types'
import { todayStr } from '@/lib/dates'
import { fmtKcal, mealTotals, scaleMacros, type Macros } from '@/lib/macros'
import { accentById } from '@/theme/accents'

interface LogMealSheetProps {
  open: boolean
  onClose: () => void
  meal: Meal
  onLogged?: () => void
}

type Who = 'single' | 'split'
type Mode = 'pct' | 'grams'

export function LogMealSheet({ open, onClose, meal, onLogged }: LogMealSheetProps) {
  const toast = useToast()
  const byId = useIngredientMap()
  const profiles = useProfiles()
  const active = useActiveProfile()

  const totals = useMemo(
    () => (byId ? mealTotals(meal, byId) : { macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, grams: 0, missing: [] }),
    [meal, byId],
  )
  const mealGrams = Math.round(totals.grams) || 0
  const canSplit = (profiles?.length ?? 0) === 2

  const [date, setDate] = useState(todayStr())
  const [who, setWho] = useState<Who>('single')
  const [singleId, setSingleId] = useState<string | undefined>(active?.id)
  const [mode, setMode] = useState<Mode>('pct')

  // percent mode
  const [eatenPct, setEatenPct] = useState(100)
  const [yourPct, setYourPct] = useState(50)

  // grams mode
  const [totalGrams, setTotalGrams] = useState(mealGrams)
  const [gramsA, setGramsA] = useState(mealGrams ? Math.round(mealGrams / 2) : 0)
  const [gramsB, setGramsB] = useState(mealGrams ? mealGrams - Math.round(mealGrams / 2) : 0)
  const [touchedGrams, setTouchedGrams] = useState(false)

  // seed the weight fields once the meal totals resolve
  useEffect(() => {
    if (touchedGrams || mealGrams <= 0) return
    setTotalGrams(mealGrams)
    setGramsA(Math.round(mealGrams / 2))
    setGramsB(mealGrams - Math.round(mealGrams / 2))
  }, [mealGrams, touchedGrams])

  const singleProfile = profiles?.find((p) => p.id === (singleId ?? active?.id))
  const profA = active
  const profB = profiles?.find((p) => p.id !== active?.id)

  function scaleByGrams(grams: number): Macros {
    const t = totalGrams > 0 ? totalGrams : mealGrams || 1
    return scaleMacros(totals.macros, grams / t)
  }

  const preview = useMemo(() => {
    if (who === 'single') {
      const macros =
        mode === 'grams' ? scaleByGrams(gramsA) : scaleMacros(totals.macros, eatenPct / 100)
      return { single: macros }
    }
    if (mode === 'grams') {
      return { a: scaleByGrams(gramsA), b: scaleByGrams(gramsB) }
    }
    const eaten = scaleMacros(totals.macros, eatenPct / 100)
    return {
      a: scaleMacros(eaten, yourPct / 100),
      b: scaleMacros(eaten, (100 - yourPct) / 100),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who, mode, eatenPct, yourPct, gramsA, gramsB, totalGrams, totals])

  async function submit() {
    try {
      if (who === 'single') {
        const pid = singleProfile?.id ?? active?.id
        if (!pid) return
        await addLogEntry({
          profileId: pid,
          date,
          name: meal.name,
          macros: preview.single!,
          source: 'meal',
          sourceId: meal.id,
          grams: mode === 'grams' ? gramsA : null,
        })
        toast(`Logged for ${singleProfile?.name ?? 'you'}`)
      } else {
        if (!profA || !profB) return
        await addMealEvent({
          date,
          name: meal.name,
          mealId: meal.id,
          total: totals.macros,
          totalGrams: mode === 'grams' ? totalGrams : null,
          splits: [
            {
              profileId: profA.id,
              mode,
              value: mode === 'grams' ? gramsA : (eatenPct * yourPct) / 100,
              macros: preview.a!,
            },
            {
              profileId: profB.id,
              mode,
              value: mode === 'grams' ? gramsB : (eatenPct * (100 - yourPct)) / 100,
              macros: preview.b!,
            },
          ],
        })
        toast(`Split between ${profA.name} & ${profB.name}`)
      }
      onLogged?.()
      onClose()
    } catch (err) {
      toast((err as Error).message || 'Could not log')
    }
  }

  const whoOptions: { value: Who; label: string }[] = canSplit
    ? [
        { value: 'single', label: 'One of us' },
        { value: 'split', label: 'Split' },
      ]
    : [{ value: 'single', label: 'Log it' }]

  return (
    <Sheet open={open} onClose={onClose} title={`Log · ${meal.name}`}>
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-surface p-4">
          <div className="text-lg font-extrabold text-ink">{fmtKcal(totals.macros.kcal)} kcal</div>
          <MacroLine macros={totals.macros} className="mt-0.5" />
          <div className="mt-1 text-xs text-ink-faint">
            whole recipe{mealGrams ? ` · ${mealGrams} g` : ''}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] font-bold text-ink-soft">Date</span>
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-2xl bg-surface-2 px-3 py-2.5 font-bold text-ink outline-none"
          />
        </label>

        {canSplit && <Segmented options={whoOptions} value={who} onChange={setWho} />}

        {canSplit && (
          <Segmented
            options={[
              { value: 'pct', label: 'By percent' },
              { value: 'grams', label: 'By weight' },
            ]}
            value={mode}
            onChange={setMode}
          />
        )}

        {!canSplit && profiles && profiles.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSingleId(p.id)}
                className="rounded-full px-3 py-1.5 text-sm font-bold"
                style={{
                  background:
                    (singleId ?? active?.id) === p.id ? accentById(p.accent).base : 'var(--color-surface-2)',
                  color: (singleId ?? active?.id) === p.id ? 'var(--color-bg-deep)' : 'var(--color-ink-soft)',
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {who === 'single' ? (
          mode === 'grams' && canSplit ? (
            <div className="flex flex-col gap-2">
              <NumberField
                label="Cooked weight"
                value={totalGrams}
                onChange={(n) => {
                  setTouchedGrams(true)
                  setTotalGrams(n)
                }}
                suffix="g"
              />
              <NumberField
                label="How much you ate"
                value={gramsA}
                onChange={(n) => {
                  setTouchedGrams(true)
                  setGramsA(n)
                }}
                suffix="g"
              />
            </div>
          ) : (
            <PortionPicker pct={eatenPct} onChange={setEatenPct} />
          )
        ) : mode === 'grams' ? (
          <div className="flex flex-col gap-2">
            <NumberField
              label="Cooked weight"
              value={totalGrams}
              onChange={(n) => {
                setTouchedGrams(true)
                setTotalGrams(n)
              }}
              suffix="g"
            />
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label={`${profA?.name ?? 'You'} ate`}
                value={gramsA}
                onChange={(n) => {
                  setTouchedGrams(true)
                  setGramsA(n)
                }}
                suffix="g"
              />
              <NumberField
                label={`${profB?.name ?? 'Partner'} ate`}
                value={gramsB}
                onChange={(n) => {
                  setTouchedGrams(true)
                  setGramsB(n)
                }}
                suffix="g"
              />
            </div>
            <p className="px-1 text-xs text-ink-faint">
              Leftover: {Math.max(0, Math.round((totalGrams || 0) - gramsA - gramsB))} g
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <SplitSlider
              value={yourPct}
              onChange={setYourPct}
              leftLabel={profA?.name ?? 'You'}
              rightLabel={profB?.name ?? 'Partner'}
              leftAccent={accentById(profA?.accent).base}
              rightAccent={accentById(profB?.accent).base}
              leftDetail={`${fmtKcal(preview.a?.kcal ?? 0)} kcal`}
              rightDetail={`${fmtKcal(preview.b?.kcal ?? 0)} kcal`}
            />
            <details className="rounded-2xl bg-surface px-4 py-3 text-sm">
              <summary className="cursor-pointer font-bold text-ink-soft">
                Didn’t finish it? ({eatenPct}% eaten)
              </summary>
              <div className="mt-3">
                <PortionPicker pct={eatenPct} onChange={setEatenPct} />
              </div>
            </details>
          </div>
        )}

        {who === 'split' && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <SideCard name={profA?.name ?? 'You'} macros={preview.a!} />
            <SideCard name={profB?.name ?? 'Partner'} macros={preview.b!} />
          </div>
        )}
        {who === 'single' && preview.single && (
          <SideCard name={singleProfile?.name ?? 'You'} macros={preview.single} />
        )}

        <Button full onClick={submit}>
          {who === 'split' ? 'Log split' : 'Log meal'}
        </Button>
      </div>
    </Sheet>
  )
}

function PortionPicker({ pct, onChange }: { pct: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {[25, 50, 75, 100].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className="flex-1 rounded-full py-2 text-sm font-bold"
            style={{
              background: pct === v ? 'var(--color-accent)' : 'var(--color-surface-2)',
              color: pct === v ? 'var(--color-bg-deep)' : 'var(--color-ink-soft)',
            }}
          >
            {v === 100 ? 'All' : `${v}%`}
          </button>
        ))}
      </div>
      <input
        type="range"
        min={5}
        max={100}
        step={5}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full appearance-none rounded-full"
        style={{
          background: `linear-gradient(to right, var(--color-accent) ${pct}%, var(--color-surface-2) ${pct}%)`,
          accentColor: 'var(--color-accent)',
        }}
      />
    </div>
  )
}

function SideCard({ name, macros }: { name: string; macros: Macros }) {
  return (
    <div className="rounded-2xl bg-surface p-3">
      <div className="text-xs font-bold text-ink-soft">{name}</div>
      <div className="mt-0.5 font-extrabold text-ink">{fmtKcal(macros.kcal)} kcal</div>
      <MacroLine macros={macros} className="mt-0.5" />
    </div>
  )
}

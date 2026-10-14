import { useState } from 'react'
import { MacroLine } from '@/components/MacroBits'
import { NumberField } from '@/components/NumberField'
import { Segmented } from '@/components/Segmented'
import { fmtKcal, roundMacros, scaleMacros, ZERO_MACROS, type Macros } from '@/lib/macros'

interface QuickMacroFieldsProps {
  /** the final macros for the whole serving */
  value: Macros
  onChange: (macros: Macros) => void
}

type Mode = 'total' | 'per100'

/**
 * Macros for a quick meal: type the totals directly, or type the per-100 g
 * label values plus the package weight and let the app do the maths.
 */
export function QuickMacroFields({ value, onChange }: QuickMacroFieldsProps) {
  const [mode, setMode] = useState<Mode>('total')
  const [per100, setPer100] = useState<Macros>(ZERO_MACROS)
  const [grams, setGrams] = useState(0)

  const computed = roundMacros(scaleMacros(per100, grams / 100))

  function update(nextPer: Macros, nextGrams: number) {
    setPer100(nextPer)
    setGrams(nextGrams)
    onChange(roundMacros(scaleMacros(nextPer, nextGrams / 100)))
  }

  return (
    <div className="flex flex-col gap-2">
      <Segmented
        options={[
          { value: 'total', label: 'Total macros' },
          { value: 'per100', label: 'Per 100 g' },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'total' ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Calories"
            value={value.kcal}
            onChange={(n) => onChange({ ...value, kcal: n })}
            suffix="kcal"
          />
          <NumberField
            label="Protein"
            value={value.protein}
            onChange={(n) => onChange({ ...value, protein: n })}
            suffix="g"
          />
          <NumberField
            label="Carbs"
            value={value.carbs}
            onChange={(n) => onChange({ ...value, carbs: n })}
            suffix="g"
          />
          <NumberField
            label="Fat"
            value={value.fat}
            onChange={(n) => onChange({ ...value, fat: n })}
            suffix="g"
          />
        </div>
      ) : (
        <>
          <p className="px-1 text-[0.7rem] font-bold text-ink-soft">
            Values per 100 g (from the label)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Calories"
              value={per100.kcal}
              onChange={(n) => update({ ...per100, kcal: n }, grams)}
              suffix="kcal"
            />
            <NumberField
              label="Protein"
              value={per100.protein}
              onChange={(n) => update({ ...per100, protein: n }, grams)}
              suffix="g"
            />
            <NumberField
              label="Carbs"
              value={per100.carbs}
              onChange={(n) => update({ ...per100, carbs: n }, grams)}
              suffix="g"
            />
            <NumberField
              label="Fat"
              value={per100.fat}
              onChange={(n) => update({ ...per100, fat: n }, grams)}
              suffix="g"
            />
          </div>
          <NumberField
            label="Package weight"
            value={grams}
            onChange={(n) => update(per100, n)}
            suffix="g"
          />
          <div className="rounded-2xl bg-surface p-3">
            <div className="text-[0.7rem] font-bold text-ink-soft">Whole package</div>
            <div className="font-extrabold text-ink">{fmtKcal(computed.kcal)} kcal</div>
            <MacroLine macros={computed} className="mt-0.5" />
          </div>
        </>
      )}
    </div>
  )
}

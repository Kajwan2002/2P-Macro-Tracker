import { useState } from 'react'
import { NumberField } from '@/components/NumberField'
import { Segmented } from '@/components/Segmented'
import type { Ingredient } from '@/db/types'
import { round1 } from '@/lib/macros'

interface AmountFieldProps {
  ingredient: Ingredient
  grams: number
  onChange: (grams: number) => void
}

/** Enter an amount as grams, or as pieces when the ingredient defines a piece. */
export function AmountField({ ingredient, grams, onChange }: AmountFieldProps) {
  const hasPiece = ingredient.pieceGrams != null && ingredient.pieceGrams > 0
  const [unit, setUnit] = useState<'g' | 'piece'>('g')

  if (!hasPiece || unit === 'g') {
    return (
      <div className="flex flex-col gap-2">
        {hasPiece && (
          <Segmented
            options={[
              { value: 'g', label: 'grams' },
              { value: 'piece', label: pieceLabel(ingredient) },
            ]}
            value={unit}
            onChange={setUnit}
          />
        )}
        <NumberField label="Amount" value={grams} onChange={onChange} suffix="g" />
      </div>
    )
  }

  const per = ingredient.pieceGrams as number
  const pieces = round1(grams / per)
  return (
    <div className="flex flex-col gap-2">
      <Segmented
        options={[
          { value: 'g', label: 'grams' },
          { value: 'piece', label: pieceLabel(ingredient) },
        ]}
        value={unit}
        onChange={setUnit}
      />
      <NumberField
        label="Amount"
        value={pieces}
        onChange={(n) => onChange(round1(n * per))}
        suffix={`× ${per} g`}
      />
    </div>
  )
}

function pieceLabel(ing: Ingredient): string {
  const l = ing.pieceLabel.trim()
  return l ? `${l}s` : 'pieces'
}

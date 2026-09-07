import { newId } from '@/lib/id'
import { db, requestPersistentStorage } from './db'
import { DEFAULT_SETTINGS, type Ingredient } from './types'

type IngredientSeed = Pick<
  Ingredient,
  'name' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'pieceGrams' | 'pieceLabel'
>

const g = (
  name: string,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  pieceGrams: number | null = null,
  pieceLabel = '',
): IngredientSeed => ({ name, kcal, protein, carbs, fat, pieceGrams, pieceLabel })

// Common foods, per 100 g. All fully editable / deletable in the app.
const DEFAULT_INGREDIENTS: IngredientSeed[] = [
  g('Chicken breast, raw', 120, 23, 0, 2.6),
  g('Chicken thigh, raw', 145, 18, 0, 8),
  g('Ground beef 15%, raw', 250, 17, 0, 20),
  g('Salmon, raw', 208, 20, 0, 13),
  g('Tuna, canned in water', 116, 26, 0, 1),
  g('Egg, whole', 143, 13, 1.1, 9.5, 50, 'egg'),
  g('Egg white', 52, 11, 0.7, 0.2, 33, 'white'),
  g('Whole milk 3.5%', 62, 3.3, 4.7, 3.5),
  g('Semi-skimmed milk', 47, 3.4, 4.8, 1.6),
  g('Greek yogurt 2%', 73, 10, 3.9, 1.9),
  g('Skyr / quark 0%', 57, 11, 3.5, 0.2),
  g('Cottage cheese', 98, 11, 3.4, 4.3),
  g('Cheddar cheese', 402, 25, 1.3, 33, 30, 'slice'),
  g('Butter', 717, 0.9, 0.1, 81),
  g('Olive oil', 884, 0, 0, 100, 9, 'tbsp'),
  g('White rice, cooked', 130, 2.7, 28, 0.3),
  g('Brown rice, cooked', 123, 2.7, 26, 1),
  g('Pasta, cooked', 158, 5.8, 31, 0.9),
  g('White bread', 265, 9, 49, 3.2, 30, 'slice'),
  g('Tortilla wrap', 310, 8, 50, 8, 60, 'wrap'),
  g('Oats, dry', 379, 13, 67, 6.5),
  g('Potato, raw', 77, 2, 17, 0.1),
  g('Sweet potato, raw', 86, 1.6, 20, 0.1),
  g('Banana', 89, 1.1, 23, 0.3, 120, 'banana'),
  g('Apple', 52, 0.3, 14, 0.2, 180, 'apple'),
  g('Broccoli', 34, 2.8, 7, 0.4),
  g('Onion', 40, 1.1, 9, 0.1),
  g('Tomato', 18, 0.9, 3.9, 0.2),
  g('Lentils, cooked', 116, 9, 20, 0.4),
  g('Chickpeas, cooked', 164, 8.9, 27, 2.6),
  g('Black beans, cooked', 132, 8.9, 24, 0.5),
  g('Tofu, firm', 144, 17, 3, 9),
  g('Whey protein powder', 400, 80, 8, 6, 30, 'scoop'),
  g('Peanut butter', 588, 25, 20, 50, 16, 'tbsp'),
  g('Almonds', 579, 21, 22, 50),
  g('Sugar, white', 387, 0, 100, 0, 4, 'tsp'),
  g('Honey', 304, 0.3, 82, 0, 21, 'tbsp'),
  g('Flour, white', 364, 10, 76, 1),
  g('Ketchup', 101, 1, 24, 0.1, 17, 'tbsp'),
  g('Mayonnaise', 680, 1, 1, 75, 14, 'tbsp'),
]

interface ProfileSeed {
  name: string
  accent: string
  kcalTarget: number
  proteinTarget: number
  carbsTarget: number
  fatTarget: number
}

const DEFAULT_PROFILES: ProfileSeed[] = [
  { name: 'Me', accent: 'mint', kcalTarget: 2500, proteinTarget: 180, carbsTarget: 260, fatTarget: 80 },
  { name: 'Partner', accent: 'rose', kcalTarget: 1900, proteinTarget: 130, carbsTarget: 190, fatTarget: 63 },
]

/**
 * Runs once. Creates the settings row, the two profiles and the prebuilt
 * ingredients. Safe to call on every startup — it no-ops if already seeded.
 */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.settings, db.profiles, db.ingredients, async () => {
    const existing = await db.settings.get('app')
    if (existing?.seeded) return

    const now = Date.now()

    const profileIds = DEFAULT_PROFILES.map(() => newId())
    await db.profiles.bulkAdd(
      DEFAULT_PROFILES.map((p, i) => ({
        id: profileIds[i],
        name: p.name,
        accent: p.accent,
        kcalTarget: p.kcalTarget,
        proteinTarget: p.proteinTarget,
        carbsTarget: p.carbsTarget,
        fatTarget: p.fatTarget,
        sortOrder: i,
        createdAt: now,
        updatedAt: now,
      })),
    )

    await db.ingredients.bulkAdd(
      DEFAULT_INGREDIENTS.map((i) => ({
        id: newId(),
        name: i.name,
        kcal: i.kcal,
        protein: i.protein,
        carbs: i.carbs,
        fat: i.fat,
        pieceGrams: i.pieceGrams,
        pieceLabel: i.pieceLabel,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      })),
    )

    await db.settings.put({
      ...DEFAULT_SETTINGS,
      ...existing,
      id: 'app',
      activeProfileId: profileIds[0],
      seeded: true,
      createdAt: existing?.createdAt ?? now,
    })
  })

  void requestPersistentStorage()
}

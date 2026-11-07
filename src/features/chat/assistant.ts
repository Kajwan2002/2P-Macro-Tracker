import { db } from '@/db/db'
import { dayTotals } from '@/db/queries'
import { addIngredient, addLogEntry, addQuickMeal, getSettings } from '@/db/repo'
import { todayStr } from '@/lib/dates'
import type { FunctionDeclaration, ToolResult } from '@/lib/gemini'
import { fmtKcal, mealTotals, round1 } from '@/lib/macros'

/* --------------------------------- context -------------------------------- */

/** Rebuilt on every message so the assistant always sees today's real numbers. */
export async function buildSystemPrompt(): Promise<string> {
  const settings = await getSettings()
  const profiles = await db.profiles.orderBy('sortOrder').toArray()
  const profile = profiles.find((p) => p.id === settings.activeProfileId) ?? profiles[0]
  const [ingredients, meals, quickMeals] = await Promise.all([
    db.ingredients.toArray(),
    db.meals.toArray(),
    db.quickMeals.toArray(),
  ])
  const byId = new Map(ingredients.map((i) => [i.id, i]))
  const today = todayStr()

  let today_ = 'No profile yet.'
  if (profile) {
    const entries = await db.logEntries.where('[profileId+date]').equals([profile.id, today]).toArray()
    const t = dayTotals(entries)
    today_ = [
      `Active profile: ${profile.name}`,
      `Daily targets: ${profile.kcalTarget} kcal, ${profile.proteinTarget} g protein, ${profile.carbsTarget} g carbs, ${profile.fatTarget} g fat`,
      `Eaten so far today: ${fmtKcal(t.kcal)} kcal, ${round1(t.protein)} g protein, ${round1(t.carbs)} g carbs, ${round1(t.fat)} g fat`,
      `Remaining today: ${fmtKcal(profile.kcalTarget - t.kcal)} kcal, ${round1(profile.proteinTarget - t.protein)} g protein, ${round1(profile.carbsTarget - t.carbs)} g carbs, ${round1(profile.fatTarget - t.fat)} g fat`,
      entries.length
        ? `Logged today: ${entries.map((e) => `${e.name} (${e.kcal} kcal, P${e.protein})`).join('; ')}`
        : 'Nothing logged yet today.',
    ].join('\n')
  }

  const ing = ingredients
    .map((i) => `${i.name} [${i.kcal} kcal, P${i.protein} C${i.carbs} F${i.fat} per 100 g]`)
    .join('; ')
  const mealLine = meals
    .map((m) => {
      const t = mealTotals(m, byId).macros
      return `${m.name} (${fmtKcal(t.kcal)} kcal, P${round1(t.protein)}, whole recipe)`
    })
    .join('; ')
  const quickLine = quickMeals
    .map((q) => `${q.name} (${q.kcal} kcal, P${q.protein} C${q.carbs} F${q.fat})`)
    .join('; ')

  return `You are the assistant inside a personal macro-tracking app. Be brief, practical and friendly.
Reply in plain text only — no markdown, no asterisks, no headings. Keep answers under ~120 words unless asked for more.
Today is ${today}.

${today_}

Saved ingredients: ${ing || 'none'}
Saved meals (recipes): ${mealLine || 'none'}
Saved quick meals: ${quickLine || 'none'}

Rules:
- For "what should I eat" questions, suggest realistic ideas that fit the REMAINING macros, preferring the saved ingredients/meals above, with rough portions in grams.
- To add an ingredient the user mentions, call add_ingredient with typical nutrition values PER 100 g from your own knowledge (no web). Raw vs cooked matters — say which you assumed.
- When the user sends a photo or describes a food and wants it logged, estimate the macros for the visible/stated portion, call log_entry, and say it's an estimate.
- Only call a tool when the user clearly asks to add/log/save something. Never log food just because it was discussed.
- You cannot delete or edit existing data; tell the user to do that in the app.`
}

/* ---------------------------------- tools --------------------------------- */

const macroProps = (suffix: string) => ({
  kcal: { type: 'NUMBER' as const, description: `Calories ${suffix}` },
  protein: { type: 'NUMBER' as const, description: `Protein in grams ${suffix}` },
  carbs: { type: 'NUMBER' as const, description: `Carbohydrates in grams ${suffix}` },
  fat: { type: 'NUMBER' as const, description: `Fat in grams ${suffix}` },
})

export const TOOLS: FunctionDeclaration[] = [
  {
    name: 'add_ingredient',
    description: 'Save a new ingredient to the ingredient library. Macros are per 100 g.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Ingredient name, e.g. "Chicken breast, raw"' },
        ...macroProps('per 100 g'),
        piece_grams: { type: 'NUMBER', description: 'Optional: grams in one piece (1 egg, 1 slice)' },
        piece_label: { type: 'STRING', description: 'Optional: name of the piece, e.g. "egg"' },
      },
      required: ['name', 'kcal', 'protein', 'carbs', 'fat'],
    },
  },
  {
    name: 'log_entry',
    description: "Log a food for today on the active profile's dashboard, using the macros of the whole portion eaten.",
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Short food name' },
        ...macroProps('for the whole portion'),
      },
      required: ['name', 'kcal', 'protein', 'carbs', 'fat'],
    },
  },
  {
    name: 'save_quick_meal',
    description: 'Save a macros-only quick meal (a food without ingredients) for one-tap logging later.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Short name' },
        ...macroProps('for one serving'),
      },
      required: ['name', 'kcal', 'protein', 'carbs', 'fat'],
    },
  },
]

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export async function runTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const label = str(args.name)
  if (!label) return { response: { ok: false, error: 'name is required' } }
  const macros = {
    kcal: num(args.kcal),
    protein: num(args.protein),
    carbs: num(args.carbs),
    fat: num(args.fat),
  }

  if (name === 'add_ingredient') {
    const dupe = (await db.ingredients.toArray()).find((i) => i.name.toLowerCase() === label.toLowerCase())
    if (dupe) return { response: { ok: false, error: `"${dupe.name}" already exists` } }
    const pieceGrams = num(args.piece_grams)
    await addIngredient({
      name: label,
      ...macros,
      pieceGrams: pieceGrams > 0 ? pieceGrams : null,
      pieceLabel: str(args.piece_label),
    })
    return {
      response: { ok: true },
      summary: `✅ Added ingredient “${label}” (${macros.kcal} kcal · P ${macros.protein} · C ${macros.carbs} · F ${macros.fat} per 100 g)`,
    }
  }

  if (name === 'log_entry') {
    const settings = await getSettings()
    const profile =
      (settings.activeProfileId && (await db.profiles.get(settings.activeProfileId))) ||
      (await db.profiles.orderBy('sortOrder').first())
    if (!profile) return { response: { ok: false, error: 'no profile' } }
    await addLogEntry({
      profileId: profile.id,
      date: todayStr(),
      name: label,
      macros,
      source: 'quick',
      sourceId: null,
      grams: null,
    })
    return {
      response: { ok: true },
      summary: `✅ Logged “${label}” for ${profile.name} — ${Math.round(macros.kcal)} kcal · P ${round1(macros.protein)} · C ${round1(macros.carbs)} · F ${round1(macros.fat)}`,
    }
  }

  if (name === 'save_quick_meal') {
    await addQuickMeal({ name: label, ...macros })
    return { response: { ok: true }, summary: `✅ Saved quick meal “${label}” (${Math.round(macros.kcal)} kcal)` }
  }

  return { response: { ok: false, error: `unknown tool ${name}` } }
}

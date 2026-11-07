import { db } from '@/db/db'
import { dayTotals } from '@/db/queries'
import {
  addIngredient,
  addLogEntry,
  addMeal,
  addMealEvent,
  addQuickMeal,
  deleteIngredient,
  deleteLogEntry,
  deleteMeal,
  deleteQuickMeal,
  getSettings,
  ingredientUsage,
  setCheatDay,
  setWeight,
  updateIngredient,
  updateLogEntry,
  updateMeal,
  updateProfile,
  updateQuickMeal,
} from '@/db/repo'
import type { Ingredient, Profile } from '@/db/types'
import { lastNDays, todayStr } from '@/lib/dates'
import type { FunctionDeclaration, Schema, ToolResult } from '@/lib/gemini'
import {
  addMacros,
  fmtKcal,
  macrosForGrams,
  mealTotals,
  round1,
  scaleMacros,
  ZERO_MACROS,
  type Macros,
} from '@/lib/macros'

type Args = Record<string, unknown>

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
    .map((i) => `${i.name} [${i.kcal} kcal, P${i.protein} C${i.carbs} F${i.fat} per 100 g${i.pieceGrams ? `; 1 ${i.pieceLabel || 'piece'} = ${i.pieceGrams} g` : ''}]`)
    .join('; ')
  const mealLine = meals
    .map((m) => {
      const t = mealTotals(m, byId).macros
      const parts = m.items.map((it) => `${byId.get(it.ingredientId)?.name ?? '(deleted)'} ${it.grams} g`).join(', ')
      return `${m.name} — whole recipe ${fmtKcal(t.kcal)} kcal, P${round1(t.protein)}, ${m.servings} serving(s): ${parts}`
    })
    .join('\n  ')
  const quickLine = quickMeals
    .map((q) => `${q.name} (${q.kcal} kcal, P${q.protein} C${q.carbs} F${q.fat})`)
    .join('; ')

  return `You are the assistant inside a personal macro-tracking app. You can read AND change the user's data with your tools. Be brief, practical and friendly.
Reply in plain text only — no markdown, no asterisks, no headings. Keep answers under ~120 words unless asked for more.
Today is ${today}. Profiles in this app: ${profiles.map((p) => p.name).join(', ')}.

${today_}

Saved ingredients: ${ing || 'none'}
Saved meals (recipes):
  ${mealLine || 'none'}
Saved quick meals: ${quickLine || 'none'}

How to work:
- Refer to ingredients, meals and quick meals by NAME in tool calls; the app matches names for you. If a tool says several items match, ask the user which one.
- Do what the user asks directly — no need to ask permission for adds, edits or deletes they clearly requested. Do NOT change data they didn't ask you to change, and never log food just because it was discussed.
- Deleting an ingredient that is used in meals needs the user's go-ahead: if the tool reports it, tell the user which meals use it and only retry with force=true after they say yes.
- To edit or delete a logged entry, call list_log_entries first to get its id.
- If the user wants a meal made from ingredients that don't exist yet, add those ingredients first (typical nutrition per 100 g from your own knowledge — no web), then create the meal.
- For "what should I eat" questions, suggest realistic ideas that fit the REMAINING macros, preferring saved ingredients/meals, with rough portions in grams.
- For a photo or a described food, estimate macros for the portion and say it's an estimate.
- After using tools, confirm in one short sentence what changed. The app also shows a ✅ line for each change.
- Tools act on the active profile unless you pass the profile name. Dates are YYYY-MM-DD and default to today.`
}

/* ---------------------------------- schema -------------------------------- */

const str_ = (description: string): Schema => ({ type: 'STRING', description })
const num_ = (description: string): Schema => ({ type: 'NUMBER', description })
const bool_ = (description: string): Schema => ({ type: 'BOOLEAN', description })

const PROFILE = str_('Profile name (e.g. "Partner"). Omit for the active profile.')
const DATE = str_('Date as YYYY-MM-DD. Omit for today.')

const macros = (suffix: string) => ({
  kcal: num_(`Calories ${suffix}`),
  protein: num_(`Protein in grams ${suffix}`),
  carbs: num_(`Carbohydrates in grams ${suffix}`),
  fat: num_(`Fat in grams ${suffix}`),
})

const tool = (
  name: string,
  description: string,
  properties: Record<string, Schema>,
  required: string[] = [],
): FunctionDeclaration => ({ name, description, parameters: { type: 'OBJECT', properties, required } })

const MEAL_ITEMS: Schema = {
  type: 'ARRAY',
  description: 'Ingredients of the recipe',
  items: {
    type: 'OBJECT',
    properties: { ingredient: str_('Saved ingredient name'), grams: num_('Grams used in the whole recipe') },
    required: ['ingredient', 'grams'],
  },
}

export const TOOLS: FunctionDeclaration[] = [
  // ingredients
  tool(
    'add_ingredient',
    'Save a new ingredient to the library. Macros are per 100 g.',
    {
      name: str_('Ingredient name, e.g. "Chicken breast, raw"'),
      ...macros('per 100 g'),
      piece_grams: num_('Optional: grams in one piece (1 egg, 1 slice)'),
      piece_label: str_('Optional: name of the piece, e.g. "egg"'),
    },
    ['name', 'kcal', 'protein', 'carbs', 'fat'],
  ),
  tool(
    'update_ingredient',
    'Change an existing ingredient. Only pass the fields to change. Macros are per 100 g.',
    {
      name: str_('Current ingredient name'),
      new_name: str_('New name'),
      ...macros('per 100 g'),
      piece_grams: num_('Grams per piece (0 removes the piece unit)'),
      piece_label: str_('Piece name'),
    },
    ['name'],
  ),
  tool(
    'delete_ingredient',
    'Delete an ingredient from the library. Past log entries are unaffected; saved meals using it would count it as 0, so the tool asks for confirmation first.',
    { name: str_('Ingredient name'), force: bool_('Set true only after the user confirmed deleting an ingredient used in meals') },
    ['name'],
  ),
  // quick meals
  tool(
    'save_quick_meal',
    'Save a macros-only quick meal (food without ingredients) for one-tap logging later.',
    { name: str_('Short name'), ...macros('for one serving') },
    ['name', 'kcal', 'protein', 'carbs', 'fat'],
  ),
  tool(
    'update_quick_meal',
    'Change a saved quick meal. Only pass the fields to change.',
    { name: str_('Current name'), new_name: str_('New name'), ...macros('for one serving') },
    ['name'],
  ),
  tool('delete_quick_meal', 'Delete a saved quick meal.', { name: str_('Quick meal name') }, ['name']),
  // meals
  tool(
    'create_meal',
    'Create a saved meal (recipe) from existing ingredients.',
    {
      name: str_('Meal name'),
      items: MEAL_ITEMS,
      servings: num_('How many servings the recipe makes (default 1)'),
      recipe: str_('Optional cooking notes'),
    },
    ['name', 'items'],
  ),
  tool(
    'update_meal',
    'Change a saved meal. Only pass the fields to change; items replaces the whole ingredient list.',
    {
      name: str_('Current meal name'),
      new_name: str_('New name'),
      items: MEAL_ITEMS,
      servings: num_('Servings'),
      recipe: str_('Cooking notes'),
    },
    ['name'],
  ),
  tool('delete_meal', 'Delete a saved meal (recipe). Past log entries are unaffected.', { name: str_('Meal name') }, ['name']),
  // logging
  tool(
    'log_entry',
    'Log a food by its macros for the whole portion eaten.',
    { name: str_('Short food name'), ...macros('for the whole portion'), date: DATE, profile: PROFILE },
    ['name', 'kcal', 'protein', 'carbs', 'fat'],
  ),
  tool(
    'log_ingredient',
    'Log a saved ingredient by weight.',
    { ingredient: str_('Saved ingredient name'), grams: num_('Grams eaten'), date: DATE, profile: PROFILE },
    ['ingredient', 'grams'],
  ),
  tool(
    'log_meal',
    'Log a saved meal (recipe) for one person.',
    {
      meal: str_('Saved meal name'),
      portion_percent: num_('Percent of the WHOLE recipe eaten (default 100)'),
      date: DATE,
      profile: PROFILE,
    },
    ['meal'],
  ),
  tool(
    'split_meal',
    'Log a saved meal split between the two profiles by percent of the whole recipe.',
    {
      meal: str_('Saved meal name'),
      percent: num_('Percent of the whole recipe for the named profile; the other profile gets the rest'),
      date: DATE,
      profile: PROFILE,
    },
    ['meal', 'percent'],
  ),
  tool(
    'list_log_entries',
    'List what was logged on a day (with ids), to find an entry to edit or delete.',
    { date: DATE, profile: PROFILE },
  ),
  tool(
    'update_log_entry',
    'Edit a logged entry by id (from list_log_entries). Only pass the fields to change.',
    { id: str_('Entry id'), name: str_('New name'), ...macros('for the entry') },
    ['id'],
  ),
  tool('delete_log_entry', 'Delete a logged entry by id (from list_log_entries).', { id: str_('Entry id') }, ['id']),
  // tracking
  tool('log_weight', 'Record body weight.', { kg: num_('Weight in kg'), date: DATE, profile: PROFILE }, ['kg']),
  tool(
    'set_cheat_day',
    'Mark or unmark a day as a cheat day.',
    { date: DATE, on: bool_('true to mark (default), false to unmark'), profile: PROFILE },
  ),
  tool(
    'update_targets',
    'Change daily targets. Only pass the ones to change.',
    { ...macros('per day'), profile: PROFILE },
  ),
  tool(
    'get_daily_totals',
    'Read per-day eaten totals for recent days, to answer questions about progress.',
    { days: num_('How many days back, including today (default 7, max 31)'), profile: PROFILE },
  ),
]

/* --------------------------------- helpers -------------------------------- */

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0)
const has = (a: Args, k: string) => typeof a[k] === 'number' && Number.isFinite(a[k] as number)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const fail = (error: string): ToolResult => ({ response: { ok: false, error } })
const done = (summary: string, extra: Args = {}): ToolResult => ({ response: { ok: true, ...extra }, summary: `✅ ${summary}` })

function dateArg(a: Args): string {
  const d = str(a.date)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayStr()
}

/** Find one item by name: exact match first, then a unique partial match. */
function find<T extends { name: string }>(items: T[], query: string, kind: string): { item: T } | { error: string } {
  const q = query.trim().toLowerCase()
  if (!q) return { error: `${kind} name is required` }
  const exact = items.filter((i) => i.name.toLowerCase() === q)
  if (exact.length === 1) return { item: exact[0] }
  const partial = items.filter((i) => i.name.toLowerCase().includes(q))
  if (partial.length === 1) return { item: partial[0] }
  if (partial.length === 0) return { error: `No ${kind} named "${query}"` }
  return { error: `Several ${kind}s match "${query}": ${partial.slice(0, 8).map((i) => i.name).join('; ')}. Ask the user which one.` }
}

async function profileFor(a: Args): Promise<Profile | { error: string }> {
  const profiles = await db.profiles.orderBy('sortOrder').toArray()
  const wanted = str(a.profile)
  if (wanted) {
    const f = find(profiles, wanted, 'profile')
    return 'item' in f ? f.item : f
  }
  const s = await getSettings()
  const p = profiles.find((x) => x.id === s.activeProfileId) ?? profiles[0]
  return p ?? { error: 'no profile exists' }
}

const fmtM = (m: Macros) => `${Math.round(m.kcal)} kcal · P ${round1(m.protein)} · C ${round1(m.carbs)} · F ${round1(m.fat)}`

async function resolveItems(raw: unknown): Promise<{ items: { ingredientId: string; grams: number }[] } | { error: string }> {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'items must be a non-empty list' }
  const ingredients = await db.ingredients.toArray()
  const items: { ingredientId: string; grams: number }[] = []
  const problems: string[] = []
  for (const r of raw as Args[]) {
    const f = find(ingredients, str(r?.ingredient), 'ingredient')
    if ('error' in f) problems.push(f.error)
    else items.push({ ingredientId: f.item.id, grams: num(r?.grams) })
  }
  if (problems.length) return { error: `${problems.join(' | ')}. Add missing ingredients first with add_ingredient.` }
  return { items }
}

/* ---------------------------------- run ----------------------------------- */

export async function runTool(name: string, a: Args): Promise<ToolResult> {
  switch (name) {
    /* ingredients */
    case 'add_ingredient': {
      const label = str(a.name)
      if (!label) return fail('name is required')
      const all = await db.ingredients.toArray()
      const dupe = all.find((i) => i.name.toLowerCase() === label.toLowerCase())
      if (dupe) return fail(`"${dupe.name}" already exists`)
      const pg = num(a.piece_grams)
      const m = { kcal: num(a.kcal), protein: num(a.protein), carbs: num(a.carbs), fat: num(a.fat) }
      await addIngredient({ name: label, ...m, pieceGrams: pg > 0 ? pg : null, pieceLabel: str(a.piece_label) })
      return done(`Added ingredient “${label}” (${fmtM(m)} per 100 g)`)
    }
    case 'update_ingredient': {
      const f = find(await db.ingredients.toArray(), str(a.name), 'ingredient')
      if ('error' in f) return fail(f.error)
      const i: Ingredient = f.item
      const pg = has(a, 'piece_grams') ? num(a.piece_grams) : i.pieceGrams ?? 0
      const next = {
        name: str(a.new_name) || i.name,
        kcal: has(a, 'kcal') ? num(a.kcal) : i.kcal,
        protein: has(a, 'protein') ? num(a.protein) : i.protein,
        carbs: has(a, 'carbs') ? num(a.carbs) : i.carbs,
        fat: has(a, 'fat') ? num(a.fat) : i.fat,
        pieceGrams: pg > 0 ? pg : null,
        pieceLabel: str(a.piece_label) || i.pieceLabel,
      }
      await updateIngredient(i.id, next)
      return done(`Updated ingredient “${next.name}” (${fmtM(next)} per 100 g)`)
    }
    case 'delete_ingredient': {
      const f = find(await db.ingredients.toArray(), str(a.name), 'ingredient')
      if ('error' in f) return fail(f.error)
      const used = await ingredientUsage(f.item.id)
      if (used > 0 && a.force !== true) {
        const meals = (await db.meals.toArray()).filter((m) => m.items.some((it) => it.ingredientId === f.item.id))
        return { response: { ok: false, needs_confirmation: true, error: `"${f.item.name}" is used in ${used} saved meal(s): ${meals.map((m) => m.name).join(', ')}. Ask the user; retry with force=true only if they confirm.` } }
      }
      await deleteIngredient(f.item.id)
      return done(`Deleted ingredient “${f.item.name}”`)
    }

    /* quick meals */
    case 'save_quick_meal': {
      const label = str(a.name)
      if (!label) return fail('name is required')
      const m = { kcal: num(a.kcal), protein: num(a.protein), carbs: num(a.carbs), fat: num(a.fat) }
      await addQuickMeal({ name: label, ...m })
      return done(`Saved quick meal “${label}” (${fmtM(m)})`)
    }
    case 'update_quick_meal': {
      const f = find(await db.quickMeals.toArray(), str(a.name), 'quick meal')
      if ('error' in f) return fail(f.error)
      const q = f.item
      const next = {
        name: str(a.new_name) || q.name,
        kcal: has(a, 'kcal') ? num(a.kcal) : q.kcal,
        protein: has(a, 'protein') ? num(a.protein) : q.protein,
        carbs: has(a, 'carbs') ? num(a.carbs) : q.carbs,
        fat: has(a, 'fat') ? num(a.fat) : q.fat,
      }
      await updateQuickMeal(q.id, next)
      return done(`Updated quick meal “${next.name}” (${fmtM(next)})`)
    }
    case 'delete_quick_meal': {
      const f = find(await db.quickMeals.toArray(), str(a.name), 'quick meal')
      if ('error' in f) return fail(f.error)
      await deleteQuickMeal(f.item.id)
      return done(`Deleted quick meal “${f.item.name}”`)
    }

    /* meals */
    case 'create_meal': {
      const label = str(a.name)
      if (!label) return fail('name is required')
      const r = await resolveItems(a.items)
      if ('error' in r) return fail(r.error)
      await addMeal({ name: label, items: r.items, servings: num(a.servings) || 1, recipeText: str(a.recipe) })
      return done(`Created meal “${label}” with ${r.items.length} ingredient(s)`)
    }
    case 'update_meal': {
      const f = find(await db.meals.toArray(), str(a.name), 'meal')
      if ('error' in f) return fail(f.error)
      const m = f.item
      let items = m.items
      if (a.items !== undefined) {
        const r = await resolveItems(a.items)
        if ('error' in r) return fail(r.error)
        items = r.items
      }
      await updateMeal(m.id, {
        name: str(a.new_name) || m.name,
        items,
        servings: has(a, 'servings') ? num(a.servings) || 1 : m.servings,
        recipeText: a.recipe !== undefined ? str(a.recipe) : m.recipeText,
      })
      return done(`Updated meal “${str(a.new_name) || m.name}”`)
    }
    case 'delete_meal': {
      const f = find(await db.meals.toArray(), str(a.name), 'meal')
      if ('error' in f) return fail(f.error)
      await deleteMeal(f.item.id)
      return done(`Deleted meal “${f.item.name}”`)
    }

    /* logging */
    case 'log_entry': {
      const label = str(a.name)
      if (!label) return fail('name is required')
      const p = await profileFor(a)
      if ('error' in p) return fail(p.error)
      const m = { kcal: num(a.kcal), protein: num(a.protein), carbs: num(a.carbs), fat: num(a.fat) }
      await addLogEntry({ profileId: p.id, date: dateArg(a), name: label, macros: m, source: 'quick', sourceId: null, grams: null })
      return done(`Logged “${label}” for ${p.name} — ${fmtM(m)}`)
    }
    case 'log_ingredient': {
      const f = find(await db.ingredients.toArray(), str(a.ingredient), 'ingredient')
      if ('error' in f) return fail(f.error)
      const grams = num(a.grams)
      if (grams <= 0) return fail('grams must be greater than 0')
      const p = await profileFor(a)
      if ('error' in p) return fail(p.error)
      const m = macrosForGrams(f.item, grams)
      await addLogEntry({ profileId: p.id, date: dateArg(a), name: f.item.name, macros: m, source: 'ingredient', sourceId: f.item.id, grams })
      return done(`Logged ${grams} g ${f.item.name} for ${p.name} — ${fmtM(m)}`)
    }
    case 'log_meal':
    case 'split_meal': {
      const [meals, ingredients, profiles] = await Promise.all([
        db.meals.toArray(),
        db.ingredients.toArray(),
        db.profiles.orderBy('sortOrder').toArray(),
      ])
      const f = find(meals, str(a.meal), 'meal')
      if ('error' in f) return fail(f.error)
      const meal = f.item
      const totals = mealTotals(meal, new Map(ingredients.map((i) => [i.id, i])))
      const p = await profileFor(a)
      if ('error' in p) return fail(p.error)
      const date = dateArg(a)
      const warn = totals.missing.length ? ' (some ingredients of this meal no longer exist and count as 0)' : ''

      if (name === 'log_meal') {
        const pct = has(a, 'portion_percent') ? Math.min(1000, num(a.portion_percent)) : 100
        const m = scaleMacros(totals.macros, pct / 100)
        await addLogEntry({ profileId: p.id, date, name: meal.name, macros: m, source: 'meal', sourceId: meal.id, grams: null })
        return done(`Logged ${pct}% of “${meal.name}” for ${p.name} — ${fmtM(m)}${warn}`)
      }

      const other = profiles.find((x) => x.id !== p.id)
      if (profiles.length !== 2 || !other) return fail('Splitting needs exactly two profiles')
      const pct = Math.min(100, num(a.percent))
      const mine = scaleMacros(totals.macros, pct / 100)
      const theirs = scaleMacros(totals.macros, (100 - pct) / 100)
      await addMealEvent({
        date,
        name: meal.name,
        mealId: meal.id,
        total: totals.macros,
        totalGrams: null,
        splits: [
          { profileId: p.id, mode: 'pct', value: pct, macros: mine },
          { profileId: other.id, mode: 'pct', value: 100 - pct, macros: theirs },
        ],
      })
      return done(`Split “${meal.name}”: ${p.name} ${pct}% (${fmtM(mine)}), ${other.name} ${100 - pct}% (${fmtM(theirs)})${warn}`)
    }
    case 'list_log_entries': {
      const p = await profileFor(a)
      if ('error' in p) return fail(p.error)
      const date = dateArg(a)
      const rows = await db.logEntries.where('[profileId+date]').equals([p.id, date]).toArray()
      return {
        response: {
          ok: true,
          profile: p.name,
          date,
          entries: rows.map((e) => ({ id: e.id, name: e.name, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, shared_split: !!e.mealEventId })),
        },
      }
    }
    case 'update_log_entry': {
      const e = await db.logEntries.get(str(a.id))
      if (!e) return fail('No entry with that id — call list_log_entries first')
      const m = {
        kcal: has(a, 'kcal') ? num(a.kcal) : e.kcal,
        protein: has(a, 'protein') ? num(a.protein) : e.protein,
        carbs: has(a, 'carbs') ? num(a.carbs) : e.carbs,
        fat: has(a, 'fat') ? num(a.fat) : e.fat,
      }
      const label = str(a.name) || e.name
      await updateLogEntry(e.id, { name: label, macros: m })
      return done(`Updated “${label}” (${fmtM(m)})`)
    }
    case 'delete_log_entry': {
      const e = await db.logEntries.get(str(a.id))
      if (!e) return fail('No entry with that id — call list_log_entries first')
      await deleteLogEntry(e.id)
      return done(`Deleted logged entry “${e.name}” (${e.date})`)
    }

    /* tracking */
    case 'log_weight': {
      const kg = num(a.kg)
      if (kg <= 0) return fail('kg must be greater than 0')
      const p = await profileFor(a)
      if ('error' in p) return fail(p.error)
      const date = dateArg(a)
      await setWeight(p.id, date, kg)
      return done(`Recorded ${kg} kg for ${p.name} on ${date}`)
    }
    case 'set_cheat_day': {
      const p = await profileFor(a)
      if ('error' in p) return fail(p.error)
      const on = a.on !== false
      const date = dateArg(a)
      await setCheatDay(p.id, date, on)
      return done(`${on ? 'Marked' : 'Unmarked'} ${date} as a cheat day for ${p.name}`)
    }
    case 'update_targets': {
      const p = await profileFor(a)
      if ('error' in p) return fail(p.error)
      const patch: Partial<Profile> = {}
      if (has(a, 'kcal')) patch.kcalTarget = num(a.kcal)
      if (has(a, 'protein')) patch.proteinTarget = num(a.protein)
      if (has(a, 'carbs')) patch.carbsTarget = num(a.carbs)
      if (has(a, 'fat')) patch.fatTarget = num(a.fat)
      if (Object.keys(patch).length === 0) return fail('pass at least one target')
      await updateProfile(p.id, patch)
      const n = { ...p, ...patch }
      return done(`Targets for ${p.name}: ${n.kcalTarget} kcal · P ${n.proteinTarget} · C ${n.carbsTarget} · F ${n.fatTarget}`)
    }
    case 'get_daily_totals': {
      const p = await profileFor(a)
      if ('error' in p) return fail(p.error)
      const n = Math.min(31, Math.max(1, Math.round(num(a.days) || 7)))
      const days = lastNDays(n)
      const rows = (await db.logEntries.where('profileId').equals(p.id).toArray()).filter((e) => e.date >= days[0])
      const by = new Map<string, Macros>()
      for (const e of rows) by.set(e.date, addMacros(by.get(e.date) ?? ZERO_MACROS, e))
      return {
        response: {
          ok: true,
          profile: p.name,
          targets: { kcal: p.kcalTarget, protein: p.proteinTarget, carbs: p.carbsTarget, fat: p.fatTarget },
          days: days.map((d) => {
            const m = by.get(d) ?? ZERO_MACROS
            return { date: d, kcal: Math.round(m.kcal), protein: round1(m.protein), carbs: round1(m.carbs), fat: round1(m.fat) }
          }),
        },
      }
    }
  }
  return fail(`unknown tool ${name}`)
}

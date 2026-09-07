# Macro Tracker 🥗

A private, offline macro tracker for two people — you and your partner — built as
an installable web app (PWA).

- **Dashboard** with calorie & protein rings (carbs / fat bars) per person.
- **Meal builder**: keep your own ingredient library and save the recipes you
  cook often, then log them in one tap.
- **Two profiles** in one app — switch with the pill at the top of Today / History.
- **Split a cooked meal** between both of you by percent or by weight; the
  partner's share lands on their dashboard automatically.
- **History** with 7 / 30-day calorie & protein charts and a body-weight trend.
- All data stays on the device. Export / import a backup file from Settings.

## Tech

React + TypeScript + Vite · Tailwind CSS v4 · Dexie (IndexedDB) · `vite-plugin-pwa`
· React Router. No backend, no accounts.

## Develop

```bash
npm install
npm run dev
```

| script | what it does |
| --- | --- |
| `npm run build` | type-check, generate icons, build to `dist/`, add `404.html` |
| `npm run preview` | serve the production build locally |
| `npm run lint` | oxlint |
| `npm run icons` | regenerate PWA icons |

## Deploy (GitHub Pages)

1. Push this project to the `main` branch of your GitHub repo.
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. `.github/workflows/deploy.yml` builds and publishes on every push to `main`.
   It sets `VITE_BASE=/<repo-name>/` automatically, so the app is served from
   `https://<user>.github.io/<repo-name>/`.
4. Open that URL on the phone → **Share → Add to Home Screen**.

If you later attach a custom domain, set `VITE_BASE` to `/` in the workflow.

## Data model (one IndexedDB database via Dexie)

- `profiles` — name, accent colour, daily targets (kcal / protein / carbs / fat)
- `ingredients` — macros per 100 g, optional "per piece" amount
- `meals` — saved recipes: a list of ingredient + grams, servings, notes
- `logEntries` — one food eaten by one person on one day (macros snapshotted)
- `mealEvents` — one shared cook, linking the two portions of a split
- `weights` — body-weight log per profile
- `settings` — active profile, last backup time

A backup file is a JSON dump of every table (`src/db/backup.ts`).

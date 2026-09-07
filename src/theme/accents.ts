// Each profile picks one accent. It only tints the rings, the profile switcher
// and primary buttons, so it's always obvious whose day is on screen.

export interface Accent {
  id: string
  name: string
  base: string
  deep: string
  soft: string
}

export const ACCENTS: Accent[] = [
  { id: 'mint', name: 'Mint', base: '#37e0a8', deep: '#22c48d', soft: '#2b6a5c' },
  { id: 'blue', name: 'Blue', base: '#5b9dff', deep: '#3f83ea', soft: '#2f4a7a' },
  { id: 'violet', name: 'Violet', base: '#a98bff', deep: '#8f6cf0', soft: '#4a3d7a' },
  { id: 'rose', name: 'Rose', base: '#f38ba0', deep: '#e26b86', soft: '#7a3d4c' },
  { id: 'amber', name: 'Amber', base: '#f6b64f', deep: '#e39d33', soft: '#7a5c2a' },
  { id: 'coral', name: 'Coral', base: '#ff9166', deep: '#f0754a', soft: '#7a462f' },
]

export const DEFAULT_ACCENT_ID = 'mint'

export function accentById(id: string | undefined): Accent {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0]
}

/** Overwrite the accent CSS variables on <html> with the given accent. */
export function applyAccent(id: string | undefined): void {
  const a = accentById(id)
  const root = document.documentElement
  root.style.setProperty('--color-accent', a.base)
  root.style.setProperty('--color-accent-deep', a.deep)
  root.style.setProperty('--color-accent-soft', a.soft)
}

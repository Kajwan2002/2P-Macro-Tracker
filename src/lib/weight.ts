import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { DateStr } from './dates'

export interface WeightTrend {
  /** average of the weigh-ins in the 7 days up to the latest one */
  avg7: number
  /** kg per week over the last 4 weeks (negative = losing); null with too little data */
  perWeek: number | null
}

/** Smooths out day-to-day water swings: a 7-day average and a least-squares rate. */
export function weightTrend(weights: { date: DateStr; kg: number }[]): WeightTrend | null {
  if (weights.length === 0) return null
  const last = parseISO(weights[weights.length - 1].date)
  const ago = (d: DateStr) => differenceInCalendarDays(last, parseISO(d))

  const week = weights.filter((w) => ago(w.date) < 7)
  const avg7 = week.reduce((s, w) => s + w.kg, 0) / week.length

  const recent = weights.filter((w) => ago(w.date) < 28)
  let perWeek: number | null = null
  if (recent.length >= 3 && ago(recent[0].date) >= 10) {
    const xs = recent.map((w) => -ago(w.date))
    const mx = xs.reduce((s, x) => s + x, 0) / xs.length
    const my = recent.reduce((s, w) => s + w.kg, 0) / recent.length
    let num = 0
    let den = 0
    recent.forEach((w, i) => {
      num += (xs[i] - mx) * (w.kg - my)
      den += (xs[i] - mx) ** 2
    })
    perWeek = den ? (num / den) * 7 : null
  }
  return { avg7, perWeek }
}

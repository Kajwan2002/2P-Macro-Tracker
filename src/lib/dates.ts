import { addDays, format, isToday, isYesterday, parseISO } from 'date-fns'

// Dates are stored as plain "YYYY-MM-DD" strings so there is never timezone drift.
export type DateStr = string

export function todayStr(): DateStr {
  return format(new Date(), 'yyyy-MM-dd')
}

export function toDateStr(d: Date): DateStr {
  return format(d, 'yyyy-MM-dd')
}

/** step a "YYYY-MM-DD" string by n days */
export function shiftDay(date: DateStr, n: number): DateStr {
  return toDateStr(addDays(parseISO(date), n))
}

export function isTodayStr(date: DateStr): boolean {
  return date === todayStr()
}

export function dayHeading(date: DateStr): string {
  const d = parseISO(date)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEEE, d MMM')
}

export function shortDate(date: DateStr): string {
  return format(parseISO(date), 'd MMM yyyy')
}

export function weekdayShort(date: DateStr): string {
  return format(parseISO(date), 'EEEEE')
}

/** the last `n` day-strings ending today, oldest first */
export function lastNDays(n: number, end: DateStr = todayStr()): DateStr[] {
  return Array.from({ length: n }, (_, i) => shiftDay(end, -(n - 1 - i)))
}

export { parseISO }

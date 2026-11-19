import type { Profile } from '@/db/types'
import { KCAL_PER_KG } from './weight'

/** Never suggest less than this, whatever the maths says. */
const MIN_TARGET = 1200
/** Largest deficit as a share of maintenance. */
const MAX_DEFICIT = 0.25
/** Largest change to the target in one check-in, so one noisy month can't swing it wildly. */
const MAX_STEP = 250

export type CoachStatus = 'on-track' | 'slow' | 'fast'

export interface CoachAdvice {
  /** kg lost per week right now (negative = gaining) */
  losing: number
  status: CoachStatus
  /** what the target should be, rounded to 10 */
  suggested: number
}

/**
 * Compares the real rate of loss with the goal and works out the daily target that
 * hits the goal from the estimated maintenance — within the safety limits above.
 */
export function coachAdvice(
  profile: Profile,
  goalKgPerWeek: number,
  maintenance: number,
  perWeek: number,
): CoachAdvice {
  const losing = -perWeek
  const margin = Math.max(0.1, goalKgPerWeek * 0.25)
  const status: CoachStatus =
    losing < goalKgPerWeek - margin ? 'slow' : losing > goalKgPerWeek + margin ? 'fast' : 'on-track'

  const ideal = maintenance - (goalKgPerWeek * KCAL_PER_KG) / 7
  const floor = Math.max(MIN_TARGET, maintenance * (1 - MAX_DEFICIT))
  const cur = profile.kcalTarget
  const stepped = Math.min(cur + MAX_STEP, Math.max(cur - MAX_STEP, Math.max(floor, ideal)))
  return { losing, status, suggested: Math.round(stepped / 10) * 10 }
}

/** New carb / fat targets for a new calorie target: protein stays, the rest keeps its split. */
export function rebalanceMacros(profile: Profile, kcal: number): { carbsTarget: number; fatTarget: number } {
  const rest = Math.max(0, kcal - profile.proteinTarget * 4)
  const carbKcal = profile.carbsTarget * 4
  const fatKcal = profile.fatTarget * 9
  const carbShare = carbKcal + fatKcal > 0 ? carbKcal / (carbKcal + fatKcal) : 0.5
  return {
    carbsTarget: Math.round((rest * carbShare) / 4),
    fatTarget: Math.round((rest * (1 - carbShare)) / 9),
  }
}

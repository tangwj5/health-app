import type { Gender, ActivityLevel, GoalType } from '@/types'

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

export function calcBMR(
  gender: Gender,
  weightKg: number,
  heightCm: number,
  birthYear: number
): number {
  const age = new Date().getFullYear() - birthYear
  if (gender === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161
}

export function calcCalorieTarget(
  bmr: number,
  activityLevel: ActivityLevel,
  goal: GoalType
): number {
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel]
  if (goal === 'cut') return Math.round(tdee - 400)
  if (goal === 'bulk') return Math.round(tdee + 250)
  return Math.round(tdee)
}

export function calcProteinTarget(weightKg: number, goal: GoalType): number {
  if (goal === 'cut') return Math.round(weightKg * 2.2)
  if (goal === 'bulk') return Math.round(weightKg * 2.0)
  return Math.round(weightKg * 1.7)
}

export function getNutritionStatus(
  value: number,
  target: number
): 'green' | 'yellow' | 'red' {
  const ratio = value / target
  if (ratio >= 0.85 && ratio <= 1.1) return 'green'
  if (ratio >= 0.6 && ratio < 0.85) return 'yellow'
  if (ratio > 1.1) return 'red'
  return 'yellow'
}

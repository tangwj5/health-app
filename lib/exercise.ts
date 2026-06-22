import type { ExerciseType, Intensity } from '@/types'

const MET: Record<ExerciseType, Record<Intensity, number>> = {
  walking:  { easy: 2.5, moderate: 3.5, hard: 5.0 },
  strength: { easy: 3.0, moderate: 5.0, hard: 7.0 },
}

export function estimateCalories(
  type: ExerciseType,
  intensity: Intensity,
  durationMin: number,
  weightKg: number,
): number {
  return Math.round(MET[type][intensity] * weightKg * (durationMin / 60))
}

export const INTENSITY_LABELS: Record<Intensity, string> = {
  easy: '輕鬆',
  moderate: '中等',
  hard: '激烈',
}

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  walking: '走路',
  strength: '重訓',
}

export const BODY_PARTS = ['背', '手臂', '腿', '核心', '肩', '胸', '其他'] as const

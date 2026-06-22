'use client'

import { getNutritionStatus } from '@/lib/nutrition'
import type { MealEntry } from '@/types'

interface Props {
  entries: MealEntry[]
  calorieTarget: number
  proteinTarget: number
  exerciseCalories?: number
}

function ProgressBar({ value, target, color }: { value: number; target: number; color: string }) {
  const pct = Math.min((value / target) * 100, 100)
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

const STATUS_COLORS = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
}

export function NutritionSummary({ entries, calorieTarget, proteinTarget, exerciseCalories = 0 }: Props) {
  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  const carbTarget = Math.round((calorieTarget * 0.45) / 4)
  const fatTarget = Math.round((calorieTarget * 0.3) / 9)

  const calStatus = getNutritionStatus(totals.calories, calorieTarget)
  const proteinStatus = getNutritionStatus(totals.protein, proteinTarget)

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border">
      {/* Calories */}
      <div className="flex items-end justify-between mb-2">
        <div>
          <span className="text-3xl font-bold text-gray-800">{Math.round(totals.calories)}</span>
          <span className="text-gray-400 text-sm ml-1">/ {calorieTarget} kcal</span>
        </div>
        <div className="flex gap-1.5 pb-1">
          <StatusDot status={calStatus} label="熱量" />
          <StatusDot status={proteinStatus} label="蛋白質" />
        </div>
      </div>
      <ProgressBar
        value={totals.calories}
        target={calorieTarget}
        color={STATUS_COLORS[calStatus]}
      />
      {exerciseCalories > 0 && (
        <div className="flex items-center justify-between mt-1.5 text-xs text-gray-400">
          <span className="text-orange-500">🏃 消耗 -{exerciseCalories} kcal</span>
          <span>淨攝入 <span className="font-semibold text-gray-600">{Math.round(totals.calories - exerciseCalories)}</span> kcal</span>
        </div>
      )}

      {/* Macros */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <MacroItem
          label="蛋白質"
          value={totals.protein}
          target={proteinTarget}
          unit="g"
          color="bg-blue-500"
        />
        <MacroItem
          label="碳水"
          value={totals.carbs}
          target={carbTarget}
          unit="g"
          color="bg-yellow-400"
        />
        <MacroItem
          label="脂肪"
          value={totals.fat}
          target={fatTarget}
          unit="g"
          color="bg-orange-400"
        />
      </div>
    </div>
  )
}

function MacroItem({ label, value, target, unit, color }: {
  label: string; value: number; target: number; unit: string; color: string
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-700">
        {Math.round(value)}<span className="text-gray-400 font-normal">/{target}{unit}</span>
      </p>
      <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min((value / target) * 100, 100)}%` }}
        />
      </div>
    </div>
  )
}

function StatusDot({ status, label }: { status: 'green' | 'yellow' | 'red'; label: string }) {
  const colors = { green: 'bg-green-500', yellow: 'bg-yellow-400', red: 'bg-red-500' }
  return (
    <div className="flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${colors[status]}`} />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  )
}

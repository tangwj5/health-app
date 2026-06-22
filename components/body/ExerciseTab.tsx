'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { EXERCISE_TYPE_LABELS, INTENSITY_LABELS } from '@/lib/exercise'
import type { Exercise, BodyMetric, Profile } from '@/types'

interface Props {
  profile: Profile
  exercises: Exercise[]
  metrics: BodyMetric[]
}

export function ExerciseTab({ exercises, metrics }: Props) {
  const [weekOffset, setWeekOffset] = useState(0)

  const today = new Date()
  const dow = today.getDay()
  const daysToMon = (dow === 0 ? 6 : dow - 1) + weekOffset * 7
  const weekMon = new Date(today); weekMon.setDate(today.getDate() - daysToMon); weekMon.setHours(0,0,0,0)
  const weekSun = new Date(weekMon); weekSun.setDate(weekMon.getDate() + 6); weekSun.setHours(23,59,59,999)
  const weekMonStr = format(weekMon, 'yyyy-MM-dd')
  const weekSunStr = format(weekSun, 'yyyy-MM-dd')

  const weekEx = exercises.filter(e => {
    const d = format(parseISO(e.recorded_at), 'yyyy-MM-dd')
    return d >= weekMonStr && d <= weekSunStr
  })

  const totalDuration = weekEx.reduce((s, e) => s + e.duration_min, 0)
  const totalCalories = weekEx.reduce((s, e) => s + e.calories_est, 0)
  const walkCount = weekEx.filter(e => e.exercise_type === 'walking').length
  const strengthCount = weekEx.filter(e => e.exercise_type === 'strength').length

  const partCounts: Record<string, number> = {}
  for (const e of weekEx) {
    if (e.exercise_type === 'strength') {
      for (const p of e.body_parts) partCounts[p] = (partCounts[p] || 0) + 1
    }
  }

  const weekMetrics = metrics
    .filter(m => {
      const d = format(parseISO(m.recorded_at), 'yyyy-MM-dd')
      return d >= weekMonStr && d <= weekSunStr && m.is_first_of_day
    })
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))

  const weightStart = weekMetrics.find(m => m.weight_kg != null)?.weight_kg ?? null
  const weightEnd = [...weekMetrics].reverse().find(m => m.weight_kg != null)?.weight_kg ?? null
  const weightDelta = weightStart != null && weightEnd != null && weekMetrics.length >= 2
    ? parseFloat((weightEnd - weightStart).toFixed(2)) : null
  const muscleStart = weekMetrics.find(m => m.muscle_kg != null)?.muscle_kg ?? null
  const muscleEnd = [...weekMetrics].reverse().find(m => m.muscle_kg != null)?.muscle_kg ?? null
  const muscleDelta = muscleStart != null && muscleEnd != null && weekMetrics.length >= 2
    ? parseFloat((muscleEnd - muscleStart).toFixed(2)) : null

  return (
    <div className="space-y-4">
      {/* Week navigation + summary */}
      <div className="bg-white rounded-2xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">
            {weekOffset === 0 ? '本週' : `${weekOffset}週前`}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{format(weekMon, 'M/d')} – {format(weekSun, 'M/d')}</span>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              className="w-6 h-6 rounded-full border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center text-xs"
            >‹</button>
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              disabled={weekOffset === 0}
              className="w-6 h-6 rounded-full border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center text-xs disabled:opacity-30 disabled:cursor-not-allowed"
            >›</button>
          </div>
        </div>

        {weekEx.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">本週無運動記錄</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-xl font-bold text-green-700">{weekEx.length}</p>
                <p className="text-xs text-gray-400">次</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xl font-bold text-blue-700">{totalDuration}</p>
                <p className="text-xs text-gray-400">分鐘</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-3">
                <p className="text-xl font-bold text-orange-600">{totalCalories}</p>
                <p className="text-xs text-gray-400">估算 kcal</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {walkCount > 0 && <span className="bg-gray-100 rounded-full px-2 py-0.5 text-xs text-gray-500">走路 {walkCount} 次</span>}
              {strengthCount > 0 && <span className="bg-gray-100 rounded-full px-2 py-0.5 text-xs text-gray-500">重訓 {strengthCount} 次</span>}
              {Object.entries(partCounts).map(([part, count]) => (
                <span key={part} className="bg-blue-50 text-blue-600 text-xs rounded-full px-2 py-0.5">
                  {part}{count > 1 ? ` ×${count}` : ''}
                </span>
              ))}
            </div>

            {(weightDelta != null || muscleDelta != null) && (
              <div className="border-t pt-2 mt-2 space-y-1">
                <p className="text-xs font-medium text-gray-400">體組成變化</p>
                {weightDelta != null && (
                  <p className="text-xs text-gray-700">
                    體重 {weightStart?.toFixed(1)} → {weightEnd?.toFixed(1)} kg
                    <span className={`ml-1.5 font-semibold ${weightDelta < 0 ? 'text-green-600' : weightDelta > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      ({weightDelta > 0 ? '+' : ''}{weightDelta} kg)
                    </span>
                  </p>
                )}
                {muscleDelta != null && (
                  <p className="text-xs text-gray-700">
                    肌肉量 {muscleStart?.toFixed(1)} → {muscleEnd?.toFixed(1)} kg
                    <span className={`ml-1.5 font-semibold ${muscleDelta > 0 ? 'text-blue-600' : muscleDelta < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      ({muscleDelta > 0 ? '+' : ''}{muscleDelta} kg)
                    </span>
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Exercise list */}
      {weekEx.length > 0 && (
        <div className="bg-white rounded-2xl border p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">本週記錄</p>
          <div className="space-y-2">
            {[...weekEx].reverse().map(e => (
              <div key={e.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-700">
                      {EXERCISE_TYPE_LABELS[e.exercise_type]}
                    </span>
                    {e.body_parts.length > 0 && (
                      <span className="text-xs text-blue-600">{e.body_parts.join(' / ')}</span>
                    )}
                    <span className="text-xs text-gray-400">{INTENSITY_LABELS[e.intensity]}</span>
                    <span className="text-xs text-gray-500">{e.duration_min} 分鐘</span>
                    <span className="text-xs text-orange-500">~{e.calories_est} kcal</span>
                  </div>
                  {e.note && <p className="text-xs text-gray-400 mt-0.5">{e.note}</p>}
                </div>
                <span className="text-xs text-gray-400 shrink-0">{format(parseISO(e.recorded_at), 'M/d HH:mm')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

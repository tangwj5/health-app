'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfWeek, addDays, parseISO, isToday } from 'date-fns'

interface DayData {
  date: string
  label: string
  isToday: boolean
  calories: number
  protein: number
  carbs: number
  fat: number
  sugar: number
  trans_fat: number
}

interface Props {
  profileId: string
  selectedDate: string
  calorieTarget: number
  proteinTarget: number
}

const NUTRIENTS = [
  { key: 'calories' as const, label: '熱量', unit: 'kcal', color: '#f97316' },
  { key: 'protein'  as const, label: '蛋白質', unit: 'g',   color: '#3b82f6' },
  { key: 'carbs'    as const, label: '碳水',   unit: 'g',   color: '#eab308' },
  { key: 'fat'      as const, label: '脂肪',   unit: 'g',   color: '#ef4444' },
  { key: 'sugar'    as const, label: '糖',     unit: 'g',   color: '#ec4899' },
  { key: 'trans_fat'as const, label: '反式脂肪', unit: 'g', color: '#6b7280' },
]

type NutrientKey = (typeof NUTRIENTS)[number]['key']

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export function WeeklyNutritionChart({ profileId, selectedDate, calorieTarget, proteinTarget }: Props) {
  const supabase = createClient()
  const [days, setDays] = useState<DayData[]>([])
  const [active, setActive] = useState<NutrientKey>('calories')

  useEffect(() => {
    load()
  }, [profileId, selectedDate])

  async function load() {
    const monday = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 })
    const sunday = addDays(monday, 6)
    const { data } = await supabase
      .from('meal_entries')
      .select('log_date, calories, protein, carbs, fat, sugar, trans_fat')
      .eq('profile_id', profileId)
      .gte('log_date', format(monday, 'yyyy-MM-dd'))
      .lte('log_date', format(sunday, 'yyyy-MM-dd'))

    const rows = (data || []) as Array<Record<string, unknown>>
    setDays(
      Array.from({ length: 7 }, (_, i) => {
        const day = addDays(monday, i)
        const ds = format(day, 'yyyy-MM-dd')
        const entries = rows.filter(r => r.log_date === ds)
        const sum = (k: string) => entries.reduce((s, r) => s + (Number(r[k]) || 0), 0)
        return {
          date: ds,
          label: DAY_LABELS[i],
          isToday: isToday(day),
          calories:  Math.round(sum('calories')),
          protein:   parseFloat(sum('protein').toFixed(1)),
          carbs:     parseFloat(sum('carbs').toFixed(1)),
          fat:       parseFloat(sum('fat').toFixed(1)),
          sugar:     parseFloat(sum('sugar').toFixed(1)),
          trans_fat: parseFloat(sum('trans_fat').toFixed(1)),
        }
      })
    )
  }

  const nutrient = NUTRIENTS.find(n => n.key === active)!
  const values = days.map(d => d[active])
  const target = active === 'calories' ? calorieTarget : active === 'protein' ? proteinTarget : null
  const maxVal = Math.max(...values, target ?? 0, 1)

  const CHART_H = 96 // px

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">本週營養統計</h3>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {NUTRIENTS.map(n => (
          <button
            key={n.key}
            onClick={() => setActive(n.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              active === n.key ? 'text-white' : 'bg-gray-100 text-gray-500'
            }`}
            style={active === n.key ? { backgroundColor: n.color } : undefined}
          >
            {n.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="relative" style={{ height: `${CHART_H + 32}px` }}>
        {/* Target dashed line */}
        {target !== null && (
          <div
            className="absolute inset-x-0 pointer-events-none z-10"
            style={{ bottom: `${32 + (target / maxVal) * CHART_H}px` }}
          >
            <div className="border-t-2 border-dashed" style={{ borderColor: nutrient.color, opacity: 0.6 }} />
            <span className="absolute right-0 -top-4 text-xs font-medium" style={{ color: nutrient.color }}>
              {target}
            </span>
          </div>
        )}

        {/* Bars row */}
        <div className="absolute inset-x-0 bottom-0 flex gap-1 items-end" style={{ height: `${CHART_H + 32}px` }}>
          {days.map(day => {
            const val = day[active]
            const barH = val > 0 ? Math.max((val / maxVal) * CHART_H, 4) : 0
            const metTarget = target !== null ? val >= target * 0.9 : null

            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5" style={{ height: `${CHART_H + 32}px` }}>
                {/* Value label */}
                <div className="flex-1 flex items-end justify-center pb-0.5">
                  {val > 0 && (
                    <span className="text-xs text-gray-500 leading-none">
                      {active === 'calories' ? val : val}
                    </span>
                  )}
                </div>

                {/* Bar */}
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${barH}px`,
                    backgroundColor: metTarget === false
                      ? '#d1d5db'
                      : metTarget === true
                        ? '#22c55e'
                        : nutrient.color,
                    opacity: day.isToday ? 1 : 0.75,
                    outline: day.isToday ? `2px solid ${nutrient.color}` : 'none',
                    outlineOffset: '2px',
                  }}
                />

                {/* Day label */}
                <span
                  className="text-xs font-medium mt-1"
                  style={{ color: day.isToday ? nutrient.color : '#9ca3af' }}
                >
                  {day.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center mt-1">
        {nutrient.label}（{nutrient.unit}）
        {target ? `　目標 ${target}${nutrient.unit}，達標顯示綠色` : ''}
      </p>
    </div>
  )
}

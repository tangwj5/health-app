'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { MealPreset, MealType } from '@/types'

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '點心',
}

interface Props {
  preset: MealPreset
  profileId: string
  mealType: MealType
  logDate: string
  onClose: () => void
  onAdded: () => void
}

const RATIOS = [
  { label: '全部', value: 1 },
  { label: '3/4', value: 0.75 },
  { label: '1/2', value: 0.5 },
  { label: '1/3', value: 1 / 3 },
  { label: '1/4', value: 0.25 },
]

export function UsePresetDialog({ preset, profileId, mealType, logDate, onClose, onAdded }: Props) {
  const supabase = createClient()
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(preset.items.map(item => [item.id, item.quantity]))
  )
  const [ratio, setRatio] = useState(1)
  const [loading, setLoading] = useState(false)

  function applyRatio(r: number) {
    setRatio(r)
    setQuantities(Object.fromEntries(
      preset.items.map(item => [item.id, Math.round(item.quantity * r * 10) / 10])
    ))
  }

  function setQty(itemId: string, qty: number) {
    setRatio(-1) // custom
    setQuantities(prev => ({ ...prev, [itemId]: Math.max(0, parseFloat(qty.toFixed(1))) }))
  }

  const totals = preset.items.reduce((acc, item) => {
    const qty = quantities[item.id] ?? item.quantity
    return {
      calories: acc.calories + Math.round(item.food.calories_per_serving * qty),
      protein: parseFloat((acc.protein + item.food.protein_per_serving * qty).toFixed(1)),
      carbs: parseFloat((acc.carbs + item.food.carbs_per_serving * qty).toFixed(1)),
      fat: parseFloat((acc.fat + item.food.fat_per_serving * qty).toFixed(1)),
    }
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 })

  async function handleAdd() {
    const activeItems = preset.items.filter(item => (quantities[item.id] ?? item.quantity) > 0)
    if (!activeItems.length) return
    setLoading(true)

    const entries = activeItems.map(item => {
      const qty = quantities[item.id] ?? item.quantity
      return {
        profile_id: profileId,
        log_date: logDate,
        meal_type: mealType,
        food_id: item.food_id,
        quantity: qty,
        quantity_unit: 'serving',
        calories: Math.round(item.food.calories_per_serving * qty),
        protein: parseFloat((item.food.protein_per_serving * qty).toFixed(1)),
        carbs: parseFloat((item.food.carbs_per_serving * qty).toFixed(1)),
        fat: parseFloat((item.food.fat_per_serving * qty).toFixed(1)),
        sugar: parseFloat(((item.food.sugar_per_serving ?? 0) * qty).toFixed(1)),
        trans_fat: parseFloat(((item.food.trans_fat_per_serving ?? 0) * qty).toFixed(1)),
      }
    })

    await supabase.from('meal_entries').insert(entries)
    setLoading(false)
    onAdded()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{preset.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Ratio selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 shrink-0">吃多少？</span>
            <div className="flex gap-1 flex-1">
              {RATIOS.map(r => (
                <button
                  key={r.label}
                  onClick={() => applyRatio(r.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    ratio === r.value
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {preset.items.map(item => {
            const qty = quantities[item.id] ?? item.quantity
            const cals = Math.round(item.food.calories_per_serving * qty)
            return (
              <div key={item.id} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-800 flex-1 truncate">
                    {item.food.name_zh || item.food.name}
                  </p>
                  <p className="text-xs text-gray-400 shrink-0 ml-2">{cals} kcal</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQty(item.id, qty - 0.5)}
                    className="w-9 h-9 rounded-full border text-gray-500 hover:bg-gray-100 flex items-center justify-center text-lg font-light shrink-0"
                  >−</button>
                  <input
                    type="number"
                    value={qty}
                    onChange={e => setQty(item.id, parseFloat(e.target.value) || 0)}
                    className="flex-1 text-center text-base font-semibold border rounded-lg py-1.5 outline-none focus:ring-1 focus:ring-green-400 bg-white"
                  />
                  <button
                    onClick={() => setQty(item.id, qty + 0.5)}
                    className="w-9 h-9 rounded-full border text-gray-500 hover:bg-gray-100 flex items-center justify-center text-lg font-light shrink-0"
                  >+</button>
                  <span className="text-xs text-gray-400 w-8 text-left shrink-0">{item.food.serving_unit}</span>
                </div>
              </div>
            )
          })}

          <div className="bg-green-50 border border-green-100 rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">合計營養</p>
            <div className="grid grid-cols-4 gap-1 text-center">
              <div>
                <p className="text-sm font-bold text-gray-800">{totals.calories}</p>
                <p className="text-xs text-gray-400">kcal</p>
              </div>
              <div>
                <p className="text-sm font-bold text-blue-600">{totals.protein}g</p>
                <p className="text-xs text-gray-400">蛋白質</p>
              </div>
              <div>
                <p className="text-sm font-bold text-yellow-600">{totals.carbs}g</p>
                <p className="text-xs text-gray-400">碳水</p>
              </div>
              <div>
                <p className="text-sm font-bold text-red-500">{totals.fat}g</p>
                <p className="text-xs text-gray-400">脂肪</p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleAdd}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600"
          >
            {loading ? '加入中...' : `加入${MEAL_LABELS[mealType]}記錄`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

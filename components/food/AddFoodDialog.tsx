'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Food, MealType } from '@/types'

interface Props {
  food: Omit<Food, 'id' | 'created_by' | 'created_at'>
  foodId?: string
  profileId: string
  mealType: MealType
  logDate: string
  onClose: () => void
  onAdded: () => void
}

export function AddFoodDialog({ food, foodId, profileId, mealType, logDate, onClose, onAdded }: Props) {
  const supabase = createClient()
  const [quantityUnit, setQuantityUnit] = useState<'serving' | 'g'>('serving')
  const [quantity, setQuantity] = useState('1')
  const [loading, setLoading] = useState(false)

  const qty = parseFloat(quantity) || 0
  const factor = quantityUnit === 'g'
    ? qty / food.serving_size_g
    : qty

  const calories = Math.round(food.calories_per_serving * factor)
  const protein = parseFloat((food.protein_per_serving * factor).toFixed(1))
  const carbs = parseFloat((food.carbs_per_serving * factor).toFixed(1))
  const fat = parseFloat((food.fat_per_serving * factor).toFixed(1))

  async function handleAdd() {
    setLoading(true)

    // Upsert food to local cache if from OFF
    let resolvedFoodId: string | undefined = foodId
    if (!resolvedFoodId) {
      if (food.source === 'off' && food.barcode) {
        const { data: existing } = await supabase
          .from('foods')
          .select('id')
          .eq('barcode', food.barcode)
          .single()
        if (existing) {
          resolvedFoodId = existing.id
        } else {
          const { data: newFood } = await supabase
            .from('foods')
            .insert({ ...food, created_by: null })
            .select('id')
            .single()
          resolvedFoodId = newFood?.id
        }
      } else if (food.source === 'off') {
        const { data: newFood } = await supabase
          .from('foods')
          .insert({ ...food, created_by: null })
          .select('id')
          .single()
        resolvedFoodId = newFood?.id
      }
    }

    await supabase.from('meal_entries').insert({
      profile_id: profileId,
      log_date: logDate,
      meal_type: mealType,
      food_id: resolvedFoodId,
      quantity: qty,
      quantity_unit: quantityUnit,
      calories,
      protein,
      carbs,
      fat,
    })

    setLoading(false)
    onAdded()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug">
            {food.name_zh || food.name}
          </DialogTitle>
          {food.brand && (
            <p className="text-xs text-gray-400">{food.brand}</p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Quantity unit toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setQuantityUnit('serving')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                quantityUnit === 'serving'
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'border-gray-200 text-gray-500'
              }`}
            >
              份 / {food.serving_unit}
            </button>
            <button
              onClick={() => setQuantityUnit('g')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                quantityUnit === 'g'
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'border-gray-200 text-gray-500'
              }`}
            >
              克數 (g)
            </button>
          </div>

          {/* Quantity input */}
          <div className="space-y-1.5">
            <Label>
              {quantityUnit === 'serving'
                ? `份量（1份 = ${food.serving_size_g}g）`
                : '克數'}
            </Label>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => setQuantity(v => String(Math.max(0.5, parseFloat(v) - 0.5)))}
                className="w-10 h-10 rounded-full border text-xl font-light text-gray-600 hover:bg-gray-100 shrink-0"
              >−</button>
              <Input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="text-center text-lg font-semibold"
                min={0}
                step={quantityUnit === 'serving' ? 0.5 : 10}
              />
              <button
                onClick={() => setQuantity(v => String(parseFloat(v) + (quantityUnit === 'serving' ? 0.5 : 10)))}
                className="w-10 h-10 rounded-full border text-xl font-light text-gray-600 hover:bg-gray-100 shrink-0"
              >+</button>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-gray-800">{calories}</p>
              <p className="text-xs text-gray-400">kcal</p>
            </div>
            <div>
              <p className="text-base font-semibold text-blue-600">{protein}g</p>
              <p className="text-xs text-gray-400">蛋白質</p>
            </div>
            <div>
              <p className="text-base font-semibold text-yellow-500">{carbs}g</p>
              <p className="text-xs text-gray-400">碳水</p>
            </div>
            <div>
              <p className="text-base font-semibold text-orange-500">{fat}g</p>
              <p className="text-xs text-gray-400">脂肪</p>
            </div>
          </div>

          <Button
            onClick={handleAdd}
            disabled={loading || qty <= 0}
            className="w-full bg-green-500 hover:bg-green-600"
          >
            {loading ? '新增中...' : '加入記錄'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

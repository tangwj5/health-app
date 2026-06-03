'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { MealEntry } from '@/types'

interface Props {
  entry: MealEntry
  onClose: () => void
  onSaved: () => void
}

export function EditEntryDialog({ entry, onClose, onSaved }: Props) {
  const supabase = createClient()
  const food = entry.food
  const isCustom = food.is_custom

  const [quantity, setQuantity] = useState(String(entry.quantity))
  const [name, setName] = useState(food.name)
  const [calories, setCalories] = useState(String(food.calories_per_serving))
  const [protein, setProtein] = useState(String(food.protein_per_serving))
  const [carbs, setCarbs] = useState(String(food.carbs_per_serving))
  const [fat, setFat] = useState(String(food.fat_per_serving))
  const [sugar, setSugar] = useState(String(food.sugar_per_serving ?? 0))
  const [transFat, setTransFat] = useState(String(food.trans_fat_per_serving ?? 0))
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    const qty = parseFloat(quantity) || 1
    const calPer = parseFloat(calories) || 0
    const protPer = parseFloat(protein) || 0
    const carbPer = parseFloat(carbs) || 0
    const fatPer = parseFloat(fat) || 0
    const sugarPer = parseFloat(sugar) || 0
    const transFatPer = parseFloat(transFat) || 0

    const factor = entry.quantity_unit === 'g'
      ? qty / food.serving_size_g
      : qty

    if (isCustom) {
      await supabase.from('foods').update({
        name,
        calories_per_serving: calPer,
        protein_per_serving: protPer,
        carbs_per_serving: carbPer,
        fat_per_serving: fatPer,
        sugar_per_serving: sugarPer,
        trans_fat_per_serving: transFatPer,
      }).eq('id', food.id)
    }

    const entryFactor = entry.quantity_unit === 'g'
      ? qty / food.serving_size_g
      : qty

    const updatedCals = isCustom ? Math.round(calPer * entryFactor) : Math.round(food.calories_per_serving * factor)
    const updatedProt = isCustom ? parseFloat((protPer * entryFactor).toFixed(1)) : parseFloat((food.protein_per_serving * factor).toFixed(1))
    const updatedCarbs = isCustom ? parseFloat((carbPer * entryFactor).toFixed(1)) : parseFloat((food.carbs_per_serving * factor).toFixed(1))
    const updatedFat = isCustom ? parseFloat((fatPer * entryFactor).toFixed(1)) : parseFloat((food.fat_per_serving * factor).toFixed(1))
    const updatedSugar = isCustom ? parseFloat((sugarPer * entryFactor).toFixed(1)) : parseFloat(((food.sugar_per_serving ?? 0) * factor).toFixed(1))
    const updatedTransFat = isCustom ? parseFloat((transFatPer * entryFactor).toFixed(1)) : parseFloat(((food.trans_fat_per_serving ?? 0) * factor).toFixed(1))

    await supabase.from('meal_entries').update({
      quantity: qty,
      calories: updatedCals,
      protein: updatedProt,
      carbs: updatedCarbs,
      fat: updatedFat,
      sugar: updatedSugar,
      trans_fat: updatedTransFat,
    }).eq('id', entry.id)

    setLoading(false)
    onSaved()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle>{isCustom ? '編輯食物' : '調整份量'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {isCustom && (
            <>
              <div className="space-y-1.5">
                <Label>食物名稱</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>熱量 (kcal/份)</Label>
                  <Input type="number" value={calories} onChange={e => setCalories(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>蛋白質 (g)</Label>
                  <Input type="number" value={protein} onChange={e => setProtein(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>碳水 (g)</Label>
                  <Input type="number" value={carbs} onChange={e => setCarbs(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>脂肪 (g)</Label>
                  <Input type="number" value={fat} onChange={e => setFat(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>糖 (g)</Label>
                  <Input type="number" value={sugar} onChange={e => setSugar(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>反式脂肪 (g)</Label>
                  <Input type="number" value={transFat} onChange={e => setTransFat(e.target.value)} />
                </div>
              </div>
              <hr />
            </>
          )}
          <div className="space-y-1.5">
            <Label>份量（{entry.quantity_unit === 'g' ? 'g' : food.serving_unit}）</Label>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => setQuantity(v => String(Math.max(0.5, parseFloat(v) - (entry.quantity_unit === 'g' ? 10 : 0.5))))}
                className="w-10 h-10 rounded-full border text-xl font-light text-gray-600 hover:bg-gray-100 shrink-0"
              >−</button>
              <Input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="text-center text-lg font-semibold"
              />
              <button
                onClick={() => setQuantity(v => String(parseFloat(v) + (entry.quantity_unit === 'g' ? 10 : 0.5)))}
                className="w-10 h-10 rounded-full border text-xl font-light text-gray-600 hover:bg-gray-100 shrink-0"
              >+</button>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? '儲存中...' : '儲存'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

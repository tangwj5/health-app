'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Food } from '@/types'

interface Props {
  food: Food
  onClose: () => void
  onSaved: () => void
}

export function EditFoodDialog({ food, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(food.name)
  const [brand, setBrand] = useState(food.brand ?? '')
  const [servingSizeG, setServingSizeG] = useState(String(food.serving_size_g))
  const [servingUnit, setServingUnit] = useState(food.serving_unit)
  const [calories, setCalories] = useState(String(food.calories_per_serving))
  const [protein, setProtein] = useState(String(food.protein_per_serving))
  const [carbs, setCarbs] = useState(String(food.carbs_per_serving))
  const [fat, setFat] = useState(String(food.fat_per_serving))
  const [sugar, setSugar] = useState(String(food.sugar_per_serving ?? 0))
  const [transFat, setTransFat] = useState(String(food.trans_fat_per_serving ?? 0))

  async function handleSave() {
    if (!name || !calories) return
    setLoading(true)
    await supabase.from('foods').update({
      name,
      brand: brand || null,
      serving_size_g: parseFloat(servingSizeG) || 100,
      serving_unit: servingUnit,
      calories_per_serving: parseFloat(calories) || 0,
      protein_per_serving: parseFloat(protein) || 0,
      carbs_per_serving: parseFloat(carbs) || 0,
      fat_per_serving: parseFloat(fat) || 0,
      sugar_per_serving: parseFloat(sugar) || 0,
      trans_fat_per_serving: parseFloat(transFat) || 0,
    }).eq('id', food.id)
    setLoading(false)
    onSaved()
  }

  async function handleDelete() {
    if (!confirm(`確定要刪除「${food.name}」嗎？`)) return
    setLoading(true)
    await supabase.from('foods').delete().eq('id', food.id)
    setLoading(false)
    onSaved()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>編輯食物</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>食物名稱 *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>品牌（選填）</Label>
            <Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="自煮" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>每份克數</Label>
              <Input type="number" value={servingSizeG} onChange={e => setServingSizeG(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>份量單位</Label>
              <Input value={servingUnit} onChange={e => setServingUnit(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>每份熱量 (kcal) *</Label>
            <Input type="number" value={calories} onChange={e => setCalories(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">蛋白質 (g)</Label>
              <Input type="number" value={protein} onChange={e => setProtein(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">碳水 (g)</Label>
              <Input type="number" value={carbs} onChange={e => setCarbs(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">脂肪 (g)</Label>
              <Input type="number" value={fat} onChange={e => setFat(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">糖 (g)</Label>
              <Input type="number" value={sugar} onChange={e => setSugar(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">反式脂肪 (g)</Label>
              <Input type="number" value={transFat} onChange={e => setTransFat(e.target.value)} />
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={loading || !name || !calories}
            className="w-full bg-green-500 hover:bg-green-600"
          >
            {loading ? '儲存中...' : '儲存'}
          </Button>
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={loading}
            className="w-full text-red-500 border-red-200 hover:bg-red-50"
          >
            刪除此食物
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

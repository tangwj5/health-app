'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { MealType } from '@/types'

interface Props {
  profileId: string
  mealType: MealType
  logDate: string
  onClose: () => void
  onAdded: () => void
}

export function CustomFoodDialog({ profileId, mealType, logDate, onClose, onAdded }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    brand: '',
    serving_size_g: '100',
    serving_unit: '份',
    calories_per_serving: '',
    protein_per_serving: '0',
    carbs_per_serving: '0',
    fat_per_serving: '0',
  })

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.name || !form.calories_per_serving) return
    setLoading(true)

    const { data: food } = await supabase
      .from('foods')
      .insert({
        name: form.name,
        brand: form.brand || null,
        serving_size_g: parseFloat(form.serving_size_g),
        serving_unit: form.serving_unit,
        calories_per_serving: parseFloat(form.calories_per_serving),
        protein_per_serving: parseFloat(form.protein_per_serving),
        carbs_per_serving: parseFloat(form.carbs_per_serving),
        fat_per_serving: parseFloat(form.fat_per_serving),
        fiber_per_serving: 0,
        is_custom: true,
        created_by: profileId,
        source: 'custom',
      })
      .select('id')
      .single()

    if (food) {
      await supabase.from('meal_entries').insert({
        profile_id: profileId,
        log_date: logDate,
        meal_type: mealType,
        food_id: food.id,
        quantity: 1,
        quantity_unit: 'serving',
        calories: parseFloat(form.calories_per_serving),
        protein: parseFloat(form.protein_per_serving),
        carbs: parseFloat(form.carbs_per_serving),
        fat: parseFloat(form.fat_per_serving),
      })
      onAdded()
    }
    setLoading(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>自行新增食物</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>食物名稱 *</Label>
            <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="例如：滷雞腿" />
          </div>
          <div className="space-y-1.5">
            <Label>品牌（選填）</Label>
            <Input value={form.brand} onChange={e => update('brand', e.target.value)} placeholder="例如：自煮" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>每份克數</Label>
              <Input type="number" value={form.serving_size_g} onChange={e => update('serving_size_g', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>份量單位</Label>
              <Input value={form.serving_unit} onChange={e => update('serving_unit', e.target.value)} placeholder="份、碗、片..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>每份熱量 (kcal) *</Label>
            <Input type="number" value={form.calories_per_serving} onChange={e => update('calories_per_serving', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">蛋白質 (g)</Label>
              <Input type="number" value={form.protein_per_serving} onChange={e => update('protein_per_serving', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">碳水 (g)</Label>
              <Input type="number" value={form.carbs_per_serving} onChange={e => update('carbs_per_serving', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">脂肪 (g)</Label>
              <Input type="number" value={form.fat_per_serving} onChange={e => update('fat_per_serving', e.target.value)} />
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={loading || !form.name || !form.calories_per_serving}
            className="w-full bg-green-500 hover:bg-green-600"
          >
            {loading ? '儲存中...' : '儲存並加入記錄'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

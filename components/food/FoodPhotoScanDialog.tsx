'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RefreshCw } from 'lucide-react'
import type { MealType } from '@/types'

export interface ScanResult {
  description: string
  name: string
  serving_size_g: number
  serving_unit: string
  calories_per_serving: number
  protein_per_serving: number
  fat_per_serving: number
  carbs_per_serving: number
  sugar_per_serving: number
  trans_fat_per_serving: number
}

interface Props {
  profileId: string
  mealType: MealType
  logDate: string
  initialData: ScanResult
  onClose: () => void
  onAdded: () => void
}

export function FoodPhotoScanDialog({ profileId, mealType, logDate, initialData, onClose, onAdded }: Props) {
  const supabase = createClient()
  const [description, setDescription] = useState(initialData.description || '')
  const [form, setForm] = useState({
    name: initialData.name ?? '',
    brand: '',
    serving_size_g: String(initialData.serving_size_g ?? '100'),
    serving_unit: initialData.serving_unit ?? '份',
    calories_per_serving: String(initialData.calories_per_serving ?? ''),
    protein_per_serving: String(initialData.protein_per_serving ?? '0'),
    fat_per_serving: String(initialData.fat_per_serving ?? '0'),
    carbs_per_serving: String(initialData.carbs_per_serving ?? '0'),
    sugar_per_serving: String(initialData.sugar_per_serving ?? '0'),
    trans_fat_per_serving: String(initialData.trans_fat_per_serving ?? '0'),
  })
  const [reestimating, setReestimating] = useState(false)
  const [saving, setSaving] = useState(false)

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleReestimate() {
    if (!description.trim()) return
    setReestimating(true)
    try {
      const res = await fetch('/api/scan-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setForm({
        name: data.name ?? form.name,
        brand: form.brand,
        serving_size_g: String(data.serving_size_g ?? form.serving_size_g),
        serving_unit: data.serving_unit ?? form.serving_unit,
        calories_per_serving: String(data.calories_per_serving ?? form.calories_per_serving),
        protein_per_serving: String(data.protein_per_serving ?? form.protein_per_serving),
        fat_per_serving: String(data.fat_per_serving ?? form.fat_per_serving),
        carbs_per_serving: String(data.carbs_per_serving ?? form.carbs_per_serving),
        sugar_per_serving: String(data.sugar_per_serving ?? form.sugar_per_serving),
        trans_fat_per_serving: String(data.trans_fat_per_serving ?? form.trans_fat_per_serving),
      })
      if (data.description) setDescription(data.description)
    } catch (e) {
      alert(`重新估算失敗：${e instanceof Error ? e.message : '未知錯誤'}`)
    } finally {
      setReestimating(false)
    }
  }

  async function handleSave() {
    if (!form.name || !form.calories_per_serving) return
    setSaving(true)

    const { data: food } = await supabase
      .from('foods')
      .insert({
        name: form.name,
        brand: form.brand || null,
        serving_size_g: parseFloat(form.serving_size_g) || 100,
        serving_unit: form.serving_unit,
        calories_per_serving: parseFloat(form.calories_per_serving),
        protein_per_serving: parseFloat(form.protein_per_serving) || 0,
        carbs_per_serving: parseFloat(form.carbs_per_serving) || 0,
        fat_per_serving: parseFloat(form.fat_per_serving) || 0,
        fiber_per_serving: 0,
        sugar_per_serving: parseFloat(form.sugar_per_serving) || 0,
        trans_fat_per_serving: parseFloat(form.trans_fat_per_serving) || 0,
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
        protein: parseFloat(form.protein_per_serving) || 0,
        carbs: parseFloat(form.carbs_per_serving) || 0,
        fat: parseFloat(form.fat_per_serving) || 0,
        sugar: parseFloat(form.sugar_per_serving) || 0,
        trans_fat: parseFloat(form.trans_fat_per_serving) || 0,
      })
      onAdded()
    }
    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI 估算料理營養</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* AI description – editable */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">AI 解讀（可修改後重新估算）</Label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full text-sm border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="例如：清蒸雞腿，約 200g，去皮..."
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleReestimate}
              disabled={reestimating || !description.trim()}
              className="w-full gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reestimating ? 'animate-spin' : ''}`} />
              {reestimating ? '重新估算中...' : '重新估算'}
            </Button>
          </div>

          <div className="border-t pt-3 space-y-3">
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
                <Input value={form.serving_unit} onChange={e => update('serving_unit', e.target.value)} />
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
                <Label className="text-xs">脂肪 (g)</Label>
                <Input type="number" value={form.fat_per_serving} onChange={e => update('fat_per_serving', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">碳水 (g)</Label>
                <Input type="number" value={form.carbs_per_serving} onChange={e => update('carbs_per_serving', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">糖 (g)</Label>
                <Input type="number" value={form.sugar_per_serving} onChange={e => update('sugar_per_serving', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">反式脂肪 (g)</Label>
                <Input type="number" value={form.trans_fat_per_serving} onChange={e => update('trans_fat_per_serving', e.target.value)} />
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">數值為 AI 估算，可手動調整後儲存</p>

          <Button
            onClick={handleSave}
            disabled={saving || !form.name || !form.calories_per_serving}
            className="w-full bg-green-500 hover:bg-green-600"
          >
            {saving ? '儲存中...' : '儲存並加入記錄'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

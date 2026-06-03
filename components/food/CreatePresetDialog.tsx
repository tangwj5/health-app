'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, X } from 'lucide-react'
import type { Food, MealPreset } from '@/types'

interface SelectedItem {
  food: Food
  quantity: number
}

interface Props {
  profileId?: string
  preset?: MealPreset
  onClose: () => void
  onSaved: () => void
}

export function CreatePresetDialog({ profileId: profileIdProp, preset, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [name, setName] = useState(preset?.name ?? '')
  const [allFoods, setAllFoods] = useState<Food[]>([])
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [profileId, setProfileId] = useState(profileIdProp ?? '')

  useEffect(() => { loadFoods() }, [])

  useEffect(() => {
    if (!profileId) {
      supabase.from('profiles').select('id').order('slot').limit(1).single()
        .then(({ data }) => { if (data) setProfileId(data.id) })
    }
  }, [])

  async function loadFoods() {
    const { data } = await supabase
      .from('foods')
      .select('*')
      .eq('source', 'custom')
      .order('created_at', { ascending: false })
    if (data) {
      setAllFoods(data as Food[])
      if (preset?.items?.length) {
        setSelectedItems(preset.items.map(item => ({ food: item.food, quantity: item.quantity })))
      }
    }
  }

  function addFood(food: Food) {
    if (selectedItems.some(i => i.food.id === food.id)) return
    setSelectedItems(prev => [...prev, { food, quantity: 1 }])
  }

  function removeItem(foodId: string) {
    setSelectedItems(prev => prev.filter(i => i.food.id !== foodId))
  }

  function setQty(foodId: string, qty: number) {
    const clamped = Math.max(0.5, parseFloat(qty.toFixed(1)))
    setSelectedItems(prev => prev.map(i => i.food.id === foodId ? { ...i, quantity: clamped } : i))
  }

  async function handleSave() {
    if (!name.trim() || !selectedItems.length) return
    setLoading(true)

    if (preset) {
      await supabase.from('meal_presets').update({ name: name.trim() }).eq('id', preset.id)
      await supabase.from('meal_preset_items').delete().eq('preset_id', preset.id)
      await supabase.from('meal_preset_items').insert(
        selectedItems.map(i => ({
          preset_id: preset.id,
          food_id: i.food.id,
          quantity: i.quantity,
          quantity_unit: 'serving',
        }))
      )
    } else {
      const { data: newPreset } = await supabase
        .from('meal_presets')
        .insert({ name: name.trim(), profile_id: profileId })
        .select('id')
        .single()
      if (newPreset) {
        await supabase.from('meal_preset_items').insert(
          selectedItems.map(i => ({
            preset_id: newPreset.id,
            food_id: i.food.id,
            quantity: i.quantity,
            quantity_unit: 'serving',
          }))
        )
      }
    }

    setLoading(false)
    onSaved()
  }

  async function handleDelete() {
    if (!preset || !confirm(`確定要刪除「${preset.name}」餐點組合嗎？`)) return
    setLoading(true)
    await supabase.from('meal_presets').delete().eq('id', preset.id)
    setLoading(false)
    onSaved()
  }

  const availableFoods = allFoods.filter(f =>
    !selectedItems.some(i => i.food.id === f.id) &&
    (f.name_zh || f.name).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{preset ? '編輯餐點組合' : '建立餐點組合'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>組合名稱 *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="例如：櫛瓜烘蛋" />
          </div>

          {selectedItems.length > 0 && (
            <div className="space-y-1.5">
              <Label>已選食材</Label>
              <div className="space-y-2">
                {selectedItems.map(item => (
                  <div key={item.food.id} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
                    <span className="flex-1 text-sm font-medium truncate">{item.food.name_zh || item.food.name}</span>
                    <button
                      onClick={() => setQty(item.food.id, item.quantity - 0.5)}
                      className="w-7 h-7 rounded-full border text-gray-500 hover:bg-gray-100 flex items-center justify-center text-base"
                    >−</button>
                    <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => setQty(item.food.id, item.quantity + 0.5)}
                      className="w-7 h-7 rounded-full border text-gray-500 hover:bg-gray-100 flex items-center justify-center text-base"
                    >+</button>
                    <span className="text-xs text-gray-400 w-6 shrink-0">{item.food.serving_unit}</span>
                    <button onClick={() => removeItem(item.food.id)} className="text-gray-300 hover:text-red-400">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>新增食材</Label>
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜尋自訂食物..."
            />
            <div className="max-h-44 overflow-y-auto space-y-1 mt-1">
              {availableFoods.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">
                  {allFoods.length === 0 ? '請先在搜尋頁建立自訂食物' : '找不到符合的食物'}
                </p>
              )}
              {availableFoods.map(food => (
                <button
                  key={food.id}
                  onClick={() => addFood(food)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border hover:bg-blue-50 hover:border-blue-200 text-left transition-colors"
                >
                  <span className="text-sm font-medium truncate">{food.name_zh || food.name}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs text-gray-400">{food.calories_per_serving} kcal/{food.serving_unit}</span>
                    <Plus className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={loading || !name.trim() || selectedItems.length === 0}
            className="w-full bg-green-500 hover:bg-green-600"
          >
            {loading ? '儲存中...' : (preset ? '更新組合' : '建立組合')}
          </Button>

          {preset && (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={loading}
              className="w-full text-red-500 border-red-200 hover:bg-red-50"
            >
              刪除此組合
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

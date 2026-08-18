'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BottomNav } from '@/components/layout/BottomNav'
import { AddFoodDialog } from '@/components/food/AddFoodDialog'
import { CustomFoodDialog } from '@/components/food/CustomFoodDialog'
import { Search, ArrowLeft, Plus, Clock, Star, Pencil, UtensilsCrossed, Camera } from 'lucide-react'
import { EditFoodDialog } from '@/components/food/EditFoodDialog'
import { CreatePresetDialog } from '@/components/food/CreatePresetDialog'
import { UsePresetDialog } from '@/components/food/UsePresetDialog'
import { FoodPhotoScanDialog } from '@/components/food/FoodPhotoScanDialog'
import type { Food, MealType, MealPreset, OFFProduct, Profile } from '@/types'

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '點心',
}

function parseOFFProduct(p: OFFProduct): Omit<Food, 'id' | 'created_by' | 'created_at'> {
  const n = p.nutriments ?? {}
  const per100 = n['energy-kcal_100g'] != null
  const servingG = p.serving_quantity || 100
  const factor = per100 ? servingG / 100 : 1

  return {
    barcode: p.code || null,
    name: p.product_name || '未知食品',
    name_zh: (p as unknown as Record<string, string>)['product_name_zh-TW'] || null,
    brand: p.brands || null,
    serving_size_g: servingG,
    serving_unit: p.serving_size || '份',
    calories_per_serving: parseFloat(((per100 ? n['energy-kcal_100g'] || 0 : n['energy-kcal_serving'] || 0) * factor).toFixed(1)),
    protein_per_serving: parseFloat(((per100 ? n.proteins_100g || 0 : n.proteins_serving || 0) * (per100 ? factor : 1)).toFixed(1)),
    carbs_per_serving: parseFloat(((per100 ? n.carbohydrates_100g || 0 : n.carbohydrates_serving || 0) * (per100 ? factor : 1)).toFixed(1)),
    fat_per_serving: parseFloat(((per100 ? n.fat_100g || 0 : n.fat_serving || 0) * (per100 ? factor : 1)).toFixed(1)),
    fiber_per_serving: parseFloat(((per100 ? n.fiber_100g || 0 : 0) * (per100 ? factor : 1)).toFixed(1)),
    sugar_per_serving: parseFloat(((per100 ? n.sugars_100g || 0 : n.sugars_serving || 0) * (per100 ? factor : 1)).toFixed(1)),
    trans_fat_per_serving: parseFloat(((per100 ? n['trans-fat_100g'] || 0 : n['trans-fat_serving'] || 0) * (per100 ? factor : 1)).toFixed(1)),
    is_custom: false,
    source: 'off' as const,
  }
}

function SearchContent() {
  const router = useRouter()
  const params = useSearchParams()
  const mealType = (params.get('meal') || 'breakfast') as MealType
  const selectedDate = params.get('date') || ''

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const abortRef = useRef<AbortController | null>(null)
  const { activeProfile, profiles, setProfiles } = useAppStore()
  const profile = activeProfile()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OFFProduct[]>([])
  const [customResults, setCustomResults] = useState<Food[]>([])
  const [recentFoods, setRecentFoods] = useState<Food[]>([])
  const [allCustomFoods, setAllCustomFoods] = useState<Food[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedFood, setSelectedFood] = useState<Omit<Food, 'id' | 'created_by' | 'created_at'> | null>(null)
  const [selectedFoodId, setSelectedFoodId] = useState<string | undefined>(undefined)
  const [showCustom, setShowCustom] = useState(false)
  const [scannedData, setScannedData] = useState<Record<string, string> | null>(null)
  const [scanning, setScanning] = useState(false)
  const [foodPhotoData, setFoodPhotoData] = useState<Record<string, unknown> | null>(null)
  const [scanningFood, setScanningFood] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const foodPhotoInputRef = useRef<HTMLInputElement>(null)
  const [editingFood, setEditingFood] = useState<Food | null>(null)
  const [presets, setPresets] = useState<MealPreset[]>([])
  const [presetResults, setPresetResults] = useState<MealPreset[]>([])
  const [usingPreset, setUsingPreset] = useState<MealPreset | null>(null)
  const [editingPreset, setEditingPreset] = useState<MealPreset | null>(null)
  const [showCreatePreset, setShowCreatePreset] = useState(false)

  useEffect(() => {
    const init = async () => {
      if (profiles.length === 0) {
        const { data } = await supabase.from('profiles').select('*').order('slot')
        if (data && data.length > 0) setProfiles(data as Profile[])
      }
      loadAllCustomFoods()
      loadPresets()
    }
    init()
  }, [])

  // Run after profiles are set so profile is non-null
  useEffect(() => {
    loadRecentFoods()
  }, [profiles])

  async function loadPresets() {
    const { data } = await supabase
      .from('meal_presets')
      .select('*, items:meal_preset_items(*, food:foods(*))')
      .order('created_at', { ascending: false })
    if (data) setPresets(data as MealPreset[])
  }

  async function loadAllCustomFoods() {
    const { data } = await supabase
      .from('foods')
      .select('*')
      .eq('source', 'custom')
      .order('created_at', { ascending: false })
    if (data) setAllCustomFoods(data as Food[])
  }

  async function loadRecentFoods() {
    if (!profile) return
    const { data } = await supabase
      .from('meal_entries')
      .select('food:foods(*)')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) {
      const unique = Array.from(
        new Map(data.map((e: { food: unknown }) => [(e.food as Food).id, e.food as Food])).values()
      ).slice(0, 8) as Food[]
      setRecentFoods(unique)
    }
  }

  async function resizeImage(file: File, maxPx = 1280): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        let { width, height } = img
        if (width > maxPx || height > maxPx) {
          if (width > height) { height = Math.round(height * maxPx / width); width = maxPx }
          else { width = Math.round(width * maxPx / height); height = maxPx }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('圖片載入失敗')) }
      img.src = url
    })
  }

  async function handleScanFood(file: File) {
    setScanningFood(true)
    try {
      const base64 = await resizeImage(file)
      const res = await fetch('/api/scan-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setFoodPhotoData(data)
    } catch (e) {
      alert(`辨識失敗：${e instanceof Error ? e.message : '未知錯誤'}`)
    } finally {
      setScanningFood(false)
      if (foodPhotoInputRef.current) foodPhotoInputRef.current.value = ''
    }
  }

  async function handleScanLabel(file: File) {
    setScanning(true)
    try {
      const base64 = await resizeImage(file)
      const res = await fetch('/api/scan-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setScannedData({
        name: data.name || '',
        serving_size_g: String(data.serving_size_g ?? '100'),
        serving_unit: data.serving_unit || '份',
        calories_per_serving: String(data.calories_per_serving ?? ''),
        protein_per_serving: String(data.protein_per_serving ?? '0'),
        fat_per_serving: String(data.fat_per_serving ?? '0'),
        carbs_per_serving: String(data.carbs_per_serving ?? '0'),
        sugar_per_serving: String(data.sugar_per_serving ?? '0'),
        trans_fat_per_serving: String(data.trans_fat_per_serving ?? '0'),
      })
      setShowCustom(true)
    } catch (e) {
      alert(`辨識失敗：${e instanceof Error ? e.message : '未知錯誤'}`)
      console.error(e)
    } finally {
      setScanning(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setCustomResults([]); setPresetResults([]); return }

    // Cancel any in-flight search request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSearching(true)

    // Filter already-loaded custom foods client-side
    const lq = q.toLowerCase()
    const matched = allCustomFoods.filter(f =>
      (f.name ?? '').toLowerCase().includes(lq) ||
      (f.name_zh ?? '').toLowerCase().includes(lq) ||
      (f.brand ?? '').toLowerCase().includes(lq)
    )
    setCustomResults(matched)

    // Filter presets client-side
    const matchedPresets = presets.filter(p => p.name.toLowerCase().includes(lq))
    setPresetResults(matchedPresets)

    try {
      const res = await fetch(`/api/food-search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      const offRes = await res.json()
      if (!controller.signal.aborted) {
        const valid = (offRes.products || []).filter((p: OFFProduct) => p.nutriments != null && p.product_name)
        setResults(valid)
      }
    } catch {
      if (!controller.signal.aborted) {
        setResults([])
      }
    } finally {
      if (!controller.signal.aborted) {
        setSearching(false)
      }
    }
  }, [allCustomFoods, presets])

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 500)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  function selectOFFProduct(p: OFFProduct) {
    setSelectedFood(parseOFFProduct(p))
  }

  function selectExistingFood(food: Food) {
    setSelectedFoodId(food.id)
    setSelectedFood({
      barcode: food.barcode,
      name: food.name,
      name_zh: food.name_zh,
      brand: food.brand,
      serving_size_g: food.serving_size_g,
      serving_unit: food.serving_unit,
      calories_per_serving: food.calories_per_serving,
      protein_per_serving: food.protein_per_serving,
      carbs_per_serving: food.carbs_per_serving,
      fat_per_serving: food.fat_per_serving,
      fiber_per_serving: food.fiber_per_serving,
      sugar_per_serving: food.sugar_per_serving ?? 0,
      trans_fat_per_serving: food.trans_fat_per_serving ?? 0,
      is_custom: food.is_custom,
      source: food.source,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-500">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                className="pl-9 rounded-full bg-gray-100 border-0"
                placeholder="搜尋食物名稱..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400">新增到</span>
              {profile && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  profile.slot === 2
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {profile.display_name}
                </span>
              )}
              <Badge variant="secondary" className="text-xs">{MEAL_LABELS[mealType]}</Badge>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
                className="flex items-center gap-1 text-xs text-purple-600 border border-purple-200 bg-purple-50 rounded-full px-2.5 py-1 hover:bg-purple-100 disabled:opacity-50"
              >
                <Camera className="h-3 w-3" />
                {scanning ? '辨識中...' : '掃標示'}
              </button>
              <button
                onClick={() => foodPhotoInputRef.current?.click()}
                disabled={scanningFood}
                className="flex items-center gap-1 text-xs text-orange-600 border border-orange-200 bg-orange-50 rounded-full px-2.5 py-1 hover:bg-orange-100 disabled:opacity-50"
              >
                <Camera className="h-3 w-3" />
                {scanningFood ? '估算中...' : '拍料理'}
              </button>
              <button
                onClick={() => { setScannedData(null); setShowCustom(true) }}
                className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-full px-2.5 py-1 hover:bg-gray-50"
              >
                <Plus className="h-3 w-3" />
                新增食物
              </button>
              <button
                onClick={() => setShowCreatePreset(true)}
                className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-full px-2.5 py-1 hover:bg-gray-50"
              >
                <UtensilsCrossed className="h-3 w-3" />
                建立組合
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleScanLabel(f) }}
            />
            <input
              ref={foodPhotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleScanFood(f) }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Recent foods */}
        {!query && recentFoods.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">最近使用</span>
            </div>
            <div className="bg-white rounded-2xl border divide-y overflow-hidden">
              {recentFoods.map(food => (
                <FoodRow
                  key={food.id}
                  name={food.name_zh || food.name}
                  brand={food.brand}
                  calories={food.calories_per_serving}
                  servingUnit={food.serving_unit}
                  onClick={() => selectExistingFood(food)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Meal presets (shown when no query) */}
        {!query && presets.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <UtensilsCrossed className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">餐點組合</span>
            </div>
            <div className="bg-white rounded-2xl border divide-y overflow-hidden">
              {presets.map(preset => {
                const totalCal = preset.items.reduce((s, i) => s + Math.round(i.food.calories_per_serving * i.quantity), 0)
                return (
                  <div key={preset.id} className="flex items-center hover:bg-gray-50">
                    <button
                      onClick={() => setUsingPreset(preset)}
                      className="flex-1 flex items-center px-4 py-3 gap-3 text-left min-w-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{preset.name}</p>
                        <p className="text-xs text-gray-400">{preset.items.length} 種食材</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gray-700">{totalCal}</p>
                        <p className="text-xs text-gray-400">kcal</p>
                      </div>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setEditingPreset(preset) }}
                      className="px-3 py-3 text-gray-300 hover:text-gray-500 shrink-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* All custom foods (shown when no query) */}
        {!query && allCustomFoods.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">自訂食物</span>
            </div>
            <div className="bg-white rounded-2xl border divide-y overflow-hidden">
              {allCustomFoods.map(food => (
                <FoodRow
                  key={food.id}
                  name={food.name_zh || food.name}
                  brand={food.brand}
                  calories={food.calories_per_serving}
                  servingUnit={food.serving_unit}
                  onClick={() => selectExistingFood(food)}
                  onEdit={() => setEditingFood(food)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Search results */}
        {searching && (
          <div className="text-center py-8 text-gray-400 text-sm">搜尋中...</div>
        )}

        {/* Preset results when searching */}
        {!searching && query && presetResults.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <UtensilsCrossed className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">餐點組合</span>
            </div>
            <div className="bg-white rounded-2xl border divide-y overflow-hidden">
              {presetResults.map(preset => {
                const totalCal = preset.items.reduce((s, i) => s + Math.round(i.food.calories_per_serving * i.quantity), 0)
                return (
                  <div key={preset.id} className="flex items-center hover:bg-gray-50">
                    <button
                      onClick={() => setUsingPreset(preset)}
                      className="flex-1 flex items-center px-4 py-3 gap-3 text-left min-w-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{preset.name}</p>
                        <p className="text-xs text-gray-400">{preset.items.length} 種食材</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gray-700">{totalCal}</p>
                        <p className="text-xs text-gray-400">kcal</p>
                      </div>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setEditingPreset(preset) }}
                      className="px-3 py-3 text-gray-300 hover:text-gray-500 shrink-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!searching && query && customResults.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">自訂食物</span>
            </div>
            <div className="bg-white rounded-2xl border divide-y overflow-hidden">
              {customResults.map(food => (
                <FoodRow
                  key={food.id}
                  name={food.name}
                  brand={food.brand}
                  calories={food.calories_per_serving}
                  servingUnit={food.serving_unit}
                  onClick={() => selectExistingFood(food)}
                  onEdit={() => setEditingFood(food)}
                />
              ))}
            </div>
          </div>
        )}

        {!searching && query && results.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Search className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">搜尋結果</span>
            </div>
            <div className="bg-white rounded-2xl border divide-y overflow-hidden">
              {results.map((p, i) => (
                <FoodRow
                  key={i}
                  name={(p as unknown as Record<string, string>)['product_name_zh-TW'] || p.product_name}
                  brand={p.brands}
                  calories={(p.nutriments?.['energy-kcal_serving'] || p.nutriments?.['energy-kcal_100g'] || 0)}
                  servingUnit={p.serving_size || '份'}
                  onClick={() => selectOFFProduct(p)}
                />
              ))}
            </div>
          </div>
        )}

        {!searching && query && results.length === 0 && customResults.length === 0 && (
          <div className="text-center py-6 space-y-3">
            <p className="text-gray-400 text-sm">找不到「{query}」的結果</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCustom(true)}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              自行新增食物
            </Button>
          </div>
        )}

      </div>

      {/* Add food dialog */}
      {selectedFood && profile && (
        <AddFoodDialog
          food={selectedFood}
          foodId={selectedFoodId}
          profileId={profile.id}
          mealType={mealType}
          logDate={selectedDate}
          onClose={() => { setSelectedFood(null); setSelectedFoodId(undefined) }}
          onAdded={() => { router.back() }}
        />
      )}

      {/* Use preset dialog */}
      {usingPreset && profile && (
        <UsePresetDialog
          preset={usingPreset}
          profileId={profile.id}
          mealType={mealType}
          logDate={selectedDate}
          onClose={() => setUsingPreset(null)}
          onAdded={() => router.back()}
        />
      )}

      {/* Create preset dialog */}
      {showCreatePreset && (
        <CreatePresetDialog
          profileId={profile?.id}
          onClose={() => setShowCreatePreset(false)}
          onSaved={() => { setShowCreatePreset(false); loadPresets() }}
        />
      )}

      {/* Edit preset dialog */}
      {editingPreset && (
        <CreatePresetDialog
          profileId={profile?.id}
          preset={editingPreset}
          onClose={() => setEditingPreset(null)}
          onSaved={() => { setEditingPreset(null); loadPresets() }}
        />
      )}

      {/* Edit existing food dialog */}
      {editingFood && (
        <EditFoodDialog
          food={editingFood}
          onClose={() => setEditingFood(null)}
          onSaved={() => { setEditingFood(null); loadAllCustomFoods() }}
        />
      )}

      {/* Food photo scan dialog */}
      {foodPhotoData && profile && (
        <FoodPhotoScanDialog
          profileId={profile.id}
          mealType={mealType}
          logDate={selectedDate}
          initialData={foodPhotoData as Parameters<typeof FoodPhotoScanDialog>[0]['initialData']}
          onClose={() => setFoodPhotoData(null)}
          onAdded={() => { router.back() }}
        />
      )}

      {/* Custom food dialog */}
      {showCustom && profile && (
        <CustomFoodDialog
          profileId={profile.id}
          mealType={mealType}
          logDate={selectedDate}
          initialData={scannedData ?? undefined}
          onClose={() => { setShowCustom(false); setScannedData(null) }}
          onAdded={() => { router.back() }}
        />
      )}

      <BottomNav />
    </div>
  )
}

function FoodRow({ name, brand, calories, servingUnit, onClick, onEdit }: {
  name: string; brand?: string | null; calories: number; servingUnit: string
  onClick: () => void; onEdit?: () => void
}) {
  return (
    <div className="flex items-center hover:bg-gray-50">
      <button onClick={onClick} className="flex-1 flex items-center px-4 py-3 gap-3 text-left min-w-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
          {brand && <p className="text-xs text-gray-400 truncate">{brand}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-gray-700">{Math.round(calories)}</p>
          <p className="text-xs text-gray-400">kcal/{servingUnit}</p>
        </div>
      </button>
      {onEdit && (
        <button
          onClick={e => { e.stopPropagation(); onEdit() }}
          className="px-3 py-3 text-gray-300 hover:text-gray-500 shrink-0"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  )
}

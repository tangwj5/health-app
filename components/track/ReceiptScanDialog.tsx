'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { X, Camera, ImagePlus, Loader2, ChevronDown, ChevronUp, Check, Plus, Scissors } from 'lucide-react'
import type { ConsumableProduct, ConsumableCategory } from '@/types'

export type ItemCategory = '食物' | '食物且消耗品' | '用品' | '用品且消耗品'

const CATEGORIES: ItemCategory[] = ['食物', '食物且消耗品', '用品', '用品且消耗品']

const CATEGORY_STYLES: Record<ItemCategory, string> = {
  '食物':       'bg-green-500 text-white border-green-500',
  '食物且消耗品': 'bg-teal-500 text-white border-teal-500',
  '用品':       'bg-orange-400 text-white border-orange-400',
  '用品且消耗品': 'bg-blue-500 text-white border-blue-500',
}

const CONSUMABLE_CATEGORIES: ConsumableCategory[] = ['食品飲料', '保養藥品', '個人護理', '餐廚清潔', '其他']
const CONSUMABLE_UNITS = ['ml', 'g', '顆', '片', '個', '包', '瓶', '罐', '條', '盒', '組', '支', '雙', '件', '份', '次']

function defaultConsumableCategory(itemCat: ItemCategory): ConsumableCategory {
  return (itemCat === '食物且消耗品') ? '食品飲料' : '餐廚清潔'
}

function isConsumable(cat: ItemCategory) {
  return cat === '食物且消耗品' || cat === '用品且消耗品'
}

function geminiCategoryToLocal(cat: string): ItemCategory {
  if (cat === '食物且消耗品') return '食物且消耗品'
  if (cat === '用品且消耗品') return '用品且消耗品'
  if (cat === '用品') return '用品'
  return '食物'
}

interface ParsedItem {
  name: string
  price: number
  quantity: number
  category: ItemCategory
}

interface ProductOption extends ConsumableProduct {
  item_name: string
  item_unit: string
}

interface QuickCreateState {
  itemSearch: string
  selectedItemId: string        // '' = will create new item
  selectedItemName: string
  selectedItemUnit: string
  newCategory: ConsumableCategory
  newUnit: string
  productName: string
  purchaseQty: number
  saving: boolean
}

export function ReceiptScanDialog({
  profileId,
  onClose,
  onSaved,
}: {
  profileId: string
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'pick' | 'scanning' | 'review' | 'saving'>('pick')
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ParsedItem[]>([])
  const STORES = ['全聯', '好市多', '7-11', '全家', '寶雅']
  const [store, setStore] = useState('全聯')
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [products, setProducts] = useState<ProductOption[]>([])
  const [linkedProduct, setLinkedProduct] = useState<Record<number, string>>({})
  const [linkedQuantity, setLinkedQuantity] = useState<Record<number, number>>({})
  const [pickerOpenIdx, setPickerOpenIdx] = useState<number | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [quickCreate, setQuickCreate] = useState<Record<number, QuickCreateState>>({})
  // discountTarget[discountIdx] = targetItemIdx — null means unassigned
  const [discountTarget, setDiscountTarget] = useState<Record<number, number | null>>({})
  const [discountPickerIdx, setDiscountPickerIdx] = useState<number | null>(null)

  useEffect(() => { loadProducts() }, [profileId])

  // Auto-detect discount rows and initialise to null
  useEffect(() => {
    const targets: Record<number, number | null> = {}
    items.forEach((item, i) => { if (item.price < 0) targets[i] = null })
    setDiscountTarget(targets)
  }, [items.length])

  async function loadProducts() {
    const { data } = await supabase
      .from('consumable_products')
      .select('*, consumable_items(name)')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
    if (data) {
      setProducts((data as any[]).map(p => ({
        ...p,
        item_name: p.consumable_items?.name ?? '',
        item_unit: p.consumable_items?.unit ?? '',
      })))
    }
  }

  function fileToJpegBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const MAX = 1600
        let w = img.naturalWidth
        let h = img.naturalHeight
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX }
          else { w = Math.round(w * MAX / h); h = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('無法讀取圖片，請改用 JPEG 或 PNG 格式')) }
      img.src = url
    })
  }

  async function handleFile(file: File) {
    setError(null)
    setStep('scanning')
    try {
      const base64 = await fileToJpegBase64(file)
      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || '掃描失敗')
      if (!Array.isArray(data.items) || data.items.length === 0) throw new Error('未能識別任何品項')
      setItems(data.items.map((it: any) => ({
        ...it,
        category: geminiCategoryToLocal(it.category ?? '食物'),
      })))
      if (data.store) setStore(data.store)
      setStep('review')
    } catch (e: any) {
      setError(e.message || '掃描失敗，請重試')
      setStep('pick')
    }
  }

  // Effective price = item.price + all discounts applied to this item
  function effectivePrice(idx: number): number {
    const base = items[idx].price
    const discounts = Object.entries(discountTarget)
      .filter(([, target]) => target === idx)
      .reduce((sum, [discIdx]) => sum + items[Number(discIdx)].price, 0)
    return base + discounts
  }

  // Indices of discount rows that are assigned to a given item
  function appliedDiscounts(idx: number): number[] {
    return Object.entries(discountTarget)
      .filter(([, target]) => target === idx)
      .map(([discIdx]) => Number(discIdx))
  }

  function setCategory(idx: number, cat: ItemCategory) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, category: cat } : item))
    if (!isConsumable(cat)) {
      setLinkedProduct(prev => { const n = { ...prev }; delete n[idx]; return n })
      if (pickerOpenIdx === idx) setPickerOpenIdx(null)
      setQuickCreate(prev => { const n = { ...prev }; delete n[idx]; return n })
    }
  }

  function assignDiscount(discountIdx: number, targetIdx: number | null) {
    setDiscountTarget(prev => ({ ...prev, [discountIdx]: targetIdx }))
    setDiscountPickerIdx(null)
  }

  function linkProduct(idx: number, productId: string) {
    setLinkedProduct(prev => ({ ...prev, [idx]: productId }))
    setLinkedQuantity(prev => ({ ...prev, [idx]: items[idx].quantity }))
    setPickerOpenIdx(null)
    setProductSearch('')
    setQuickCreate(prev => { const n = { ...prev }; delete n[idx]; return n })
  }

  function unlinkProduct(idx: number) {
    setLinkedProduct(prev => { const n = { ...prev }; delete n[idx]; return n })
    setLinkedQuantity(prev => { const n = { ...prev }; delete n[idx]; return n })
  }

  function openPicker(idx: number) {
    setPickerOpenIdx(pickerOpenIdx === idx ? null : idx)
    setProductSearch('')
    setQuickCreate(prev => { const n = { ...prev }; delete n[idx]; return n })
  }

  function startQuickCreate(idx: number, suggestedName: string) {
    setQuickCreate(prev => ({
      ...prev,
      [idx]: {
        itemSearch: suggestedName,
        selectedItemId: '',
        selectedItemName: '',
        selectedItemUnit: '',
        newCategory: defaultConsumableCategory(items[idx].category),
        newUnit: 'ml',
        productName: '',
        purchaseQty: items[idx].quantity,
        saving: false,
      },
    }))
  }

  async function saveQuickCreate(idx: number) {
    const qc = quickCreate[idx]
    if (!qc) return
    const isNew = !qc.selectedItemId
    if (isNew && !qc.itemSearch.trim()) return
    if (!isNew && !qc.productName.trim()) return
    setQuickCreate(prev => ({ ...prev, [idx]: { ...prev[idx], saving: true } }))
    try {
      let itemId: string
      let itemName: string
      let itemUnit: string
      if (!isNew) {
        itemId = qc.selectedItemId
        itemName = qc.selectedItemName
        itemUnit = qc.selectedItemUnit
      } else {
        const { data: itemData } = await supabase
          .from('consumable_items')
          .insert({ profile_id: profileId, name: qc.itemSearch.trim(), category: qc.newCategory, unit: qc.newUnit })
          .select().single()
        if (!itemData) throw new Error()
        itemId = itemData.id
        itemName = qc.itemSearch.trim()
        itemUnit = qc.newUnit
      }
      const prodName = qc.productName.trim() || itemName
      const { data: prodData } = await supabase
        .from('consumable_products')
        .insert({ item_id: itemId, profile_id: profileId, name: prodName })
        .select().single()
      if (!prodData) throw new Error()
      setProducts(prev => [{ ...(prodData as ConsumableProduct), item_name: itemName, item_unit: itemUnit }, ...prev])
      setLinkedProduct(prev => ({ ...prev, [idx]: prodData.id }))
      setLinkedQuantity(prev => ({ ...prev, [idx]: qc.purchaseQty }))
      setQuickCreate(prev => { const n = { ...prev }; delete n[idx]; return n })
      setPickerOpenIdx(null)
    } catch {
      setQuickCreate(prev => ({ ...prev, [idx]: { ...prev[idx], saving: false } }))
    }
  }

  const isDiscountRow = (idx: number) => items[idx]?.price < 0
  const isAbsorbedDiscount = (idx: number) =>
    isDiscountRow(idx) && discountTarget[idx] != null

  async function handleSave() {
    setStep('saving')
    try {
      const storeVal = store.trim() || '未知通路'
      for (let i = 0; i < items.length; i++) {
        // Skip discount rows that have been merged into another item
        if (isAbsorbedDiscount(i)) continue

        const item = items[i]
        const netPrice = effectivePrice(i)
        const productId = linkedProduct[i]

        await supabase.from('receipt_temp_items').insert({
          profile_id: profileId,
          purchase_date: purchaseDate,
          store: storeVal,
          name: item.name,
          price: netPrice,
          quantity: item.quantity,
          category: item.category,
          linked_product_id: productId ?? null,
        })

        if (isConsumable(item.category) && productId) {
          const purchaseQty = linkedQuantity[i] ?? item.quantity
          await supabase.from('consumable_purchases').insert({
            product_id: productId,
            profile_id: profileId,
            purchase_date: purchaseDate,
            store: storeVal,
            price: netPrice,
            quantity: purchaseQty,
            is_promotion: netPrice < item.price,
            note: item.name,
          })
        }
      }
      onSaved()
    } catch (e: any) {
      setError(e.message || '儲存失敗')
      setStep('review')
    }
  }

  const filteredProducts = products.filter(p =>
    !productSearch || p.name.includes(productSearch) || p.item_name.includes(productSearch)
  )

  const discountIndices = Object.keys(discountTarget).map(Number)
  // Regular (non-discount) items for discount picker
  const regularItems = items.map((item, i) => ({ item, i })).filter(({ i }) => !isDiscountRow(i))

  const foodTotalCalc = items.reduce((s, item, i) => {
    if (isAbsorbedDiscount(i)) return s
    if (item.category !== '食物' && item.category !== '食物且消耗品') return s
    return s + effectivePrice(i) * item.quantity
  }, 0)
  const goodsTotalCalc = items.reduce((s, item, i) => {
    if (isAbsorbedDiscount(i)) return s
    if (item.category !== '用品' && item.category !== '用品且消耗品') return s
    return s + effectivePrice(i) * item.quantity
  }, 0)
  const unassignedDiscountTotal = discountIndices
    .filter(i => discountTarget[i] == null)
    .reduce((s, i) => s + items[i].price * items[i].quantity, 0)
  const consumableCount = items.filter((item, i) => !isDiscountRow(i) && isConsumable(item.category)).length
  const linkedCount = Object.keys(linkedProduct).length
  const savedRowCount = items.filter((_, i) => !isAbsorbedDiscount(i)).length

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full max-w-lg mx-auto rounded-t-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h3 className="text-sm font-semibold text-gray-800">
            {step === 'pick' ? '掃描收據' : step === 'scanning' ? '辨識中…' : step === 'saving' ? '儲存中…' : '確認明細'}
          </h3>
          <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
        </div>

        {step === 'pick' && (
          <div className="px-5 pb-6 space-y-4">
            {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600">{error}</div>}
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1.5">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <p><span className="font-medium text-green-600">食物</span>：食品飲料，計入飲食對帳</p>
                <p><span className="font-medium text-teal-600">食物且消耗品</span>：同上 + 追蹤存量</p>
                <p><span className="font-medium text-orange-500">用品</span>：一次性用品，計入購物對帳</p>
                <p><span className="font-medium text-blue-600">用品且消耗品</span>：同上 + 追蹤存量</p>
              </div>
              <p className="text-gray-400 pt-1">折扣/COUPON 可套用至指定品項，自動計算淨價</p>
            </div>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            <button onClick={() => cameraInputRef.current?.click()}
              className="w-full flex items-center gap-3 py-4 rounded-2xl border-2 border-dashed border-green-300 text-green-600 justify-center hover:bg-green-50 transition-colors">
              <Camera className="h-5 w-5" /><span className="text-sm font-medium">拍攝收據</span>
            </button>
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-3 py-4 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500 justify-center hover:bg-gray-50 transition-colors">
              <ImagePlus className="h-5 w-5" /><span className="text-sm font-medium">從相簿選取</span>
            </button>
          </div>
        )}

        {(step === 'scanning' || step === 'saving') && (
          <div className="px-5 pb-8 flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 text-green-500 animate-spin" />
            <p className="text-sm text-gray-500">{step === 'scanning' ? '正在辨識收據品項…' : '儲存中…'}</p>
          </div>
        )}

        {step === 'review' && (
          <>
            <div className="px-5 pb-3 flex gap-3 shrink-0">
              <div className="flex-1">
                <label className="text-xs text-gray-400 block mb-1">消費日期</label>
                <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-400 block mb-1">通路</label>
                <input list="store-list" value={store} onChange={e => setStore(e.target.value)}
                  placeholder="選擇或輸入通路"
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                <datalist id="store-list">
                  {STORES.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            </div>

            <div className="px-5 pb-2 flex gap-2 items-center shrink-0 flex-wrap text-xs">
              <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700">食 ${foodTotalCalc.toFixed(0)}</span>
              <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-600">購 ${goodsTotalCalc.toFixed(0)}</span>
              {unassignedDiscountTotal < 0 && (
                <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-500">未套用折扣 ${unassignedDiscountTotal.toFixed(0)}</span>
              )}
              {consumableCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-600">消耗品{consumableCount}（連結{linkedCount}）</span>
              )}
            </div>

            {error && <div className="mx-5 mb-2 bg-red-50 border border-red-100 rounded-xl px-4 py-2 text-xs text-red-600 shrink-0">{error}</div>}

            <div className="overflow-y-auto flex-1 px-5 pb-3 space-y-2">
              {items.map((item, idx) => {
                const isDiscount = isDiscountRow(idx)
                const absorbed = isAbsorbedDiscount(idx)
                const netPrice = effectivePrice(idx)
                const myDiscounts = appliedDiscounts(idx)
                const linked = linkedProduct[idx]
                const linkedProd = products.find(p => p.id === linked)
                const isPickerOpen = pickerOpenIdx === idx
                const qc = quickCreate[idx]
                const consumable = !isDiscount && isConsumable(item.category)
                const discPickerOpen = discountPickerIdx === idx

                if (absorbed) {
                  // Show as collapsed tag on parent item — don't render separately
                  return null
                }

                return (
                  <div key={idx} className={`rounded-2xl border overflow-hidden ${isDiscount ? 'border-red-200 bg-red-50' : 'bg-gray-50'}`}>
                    <div className="p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {isDiscount && <Scissors className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                            <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className={`text-xs ${item.price < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                              原價 ${item.price}{item.quantity > 1 && ` × ${item.quantity}`}
                            </p>
                            {myDiscounts.length > 0 && (
                              <>
                                <span className="text-xs text-gray-300">→</span>
                                <p className="text-xs font-semibold text-green-600">淨價 ${netPrice}</p>
                                <span className="text-xs text-gray-400">
                                  （折 ${(item.price - netPrice) * -1}）
                                </span>
                              </>
                            )}
                          </div>
                          {/* Applied discounts tags */}
                          {myDiscounts.map(di => (
                            <div key={di} className="mt-1 flex items-center gap-1">
                              <span className="text-xs bg-red-100 text-red-500 rounded-full px-2 py-0.5">
                                {items[di].name} ${items[di].price}
                              </span>
                              <button onClick={() => assignDiscount(di, null)}
                                className="text-xs text-gray-400 underline">移除</button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Discount row: assign to item */}
                      {isDiscount ? (
                        <div>
                          <button
                            onClick={() => setDiscountPickerIdx(discPickerOpen ? null : idx)}
                            className={`flex items-center gap-1 text-xs ${discountTarget[idx] == null ? 'text-red-400' : 'text-green-600'}`}
                          >
                            {discPickerOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {discountTarget[idx] != null
                              ? `已套用至：${items[discountTarget[idx]!].name}`
                              : '套用至哪個品項？（未套用將單獨儲存）'}
                          </button>
                          {discPickerOpen && (
                            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                              {regularItems.map(({ item: rItem, i }) => (
                                <button key={i} onClick={() => assignDiscount(idx, i)}
                                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-white transition-colors text-xs">
                                  <span className="font-medium text-gray-800">{rItem.name}</span>
                                  <span className="text-gray-400 ml-1">${effectivePrice(i)}</span>
                                </button>
                              ))}
                              {discountTarget[idx] != null && (
                                <button onClick={() => assignDiscount(idx, null)}
                                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-white transition-colors text-xs text-red-400">
                                  取消套用（單獨儲存）
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Category grid */
                        <div className="grid grid-cols-2 gap-1.5">
                          {CATEGORIES.map(cat => (
                            <button key={cat} onClick={() => setCategory(idx, cat)}
                              className={`py-1.5 text-xs rounded-lg border transition-colors ${
                                item.category === cat ? CATEGORY_STYLES[cat] : 'border-gray-200 text-gray-400 bg-white'
                              }`}
                            >{cat}</button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Consumable product linking */}
                    {consumable && (
                      <div className="border-t px-3 pb-3">
                        {linked && linkedProd ? (
                          <div className="pt-2 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Check className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                              <span className="text-xs text-gray-700 flex-1 truncate">
                                {linkedProd.item_name} · {linkedProd.name}
                              </span>
                              <button onClick={() => unlinkProduct(idx)} className="text-xs text-gray-400 underline shrink-0">取消</button>
                            </div>
                            <div className="flex items-center gap-2 pl-5">
                              <label className="text-xs text-gray-400 shrink-0">購入數量</label>
                              <input
                                type="number" min="0.01" step="any"
                                value={linkedQuantity[idx] ?? item.quantity}
                                onChange={e => setLinkedQuantity(prev => ({ ...prev, [idx]: parseFloat(e.target.value) || 1 }))}
                                className="w-20 border rounded-lg px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                              <span className="text-xs text-gray-500">{linkedProd.item_unit}</span>
                              {(linkedQuantity[idx] ?? item.quantity) > 0 && (
                                <span className="text-xs text-blue-600 ml-auto">
                                  ${(netPrice / (linkedQuantity[idx] ?? item.quantity)).toFixed(2)}/{linkedProd.item_unit}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : qc ? (
                          <div className="mt-2 space-y-2">
                            {/* Step 1: 品項 */}
                            <div>
                              <label className="text-xs text-gray-400 block mb-0.5">品項名稱</label>
                              {qc.selectedItemId ? (
                                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-blue-50">
                                  <Check className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                  <span className="text-xs text-gray-700 flex-1">{qc.selectedItemName} · {qc.selectedItemUnit}</span>
                                  <button onClick={() => setQuickCreate(prev => ({ ...prev, [idx]: { ...prev[idx], selectedItemId: '', selectedItemName: '', selectedItemUnit: '' } }))}
                                    className="text-xs text-gray-400 underline shrink-0">換</button>
                                </div>
                              ) : (
                                <>
                                  <input type="text" autoFocus value={qc.itemSearch}
                                    onChange={e => setQuickCreate(prev => ({ ...prev, [idx]: { ...prev[idx], itemSearch: e.target.value } }))}
                                    placeholder="搜尋現有品項，或輸入名稱新增"
                                    className="w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                  {/* existing items matching search */}
                                  {qc.itemSearch.length > 0 && (
                                    <div className="mt-1 max-h-24 overflow-y-auto space-y-0.5 border rounded-lg">
                                      {[...new Map(products.map(p => [p.item_id, { id: p.item_id, name: p.item_name, unit: p.item_unit }])).values()]
                                        .filter(it => it.name.includes(qc.itemSearch))
                                        .map(it => (
                                          <button key={it.id}
                                            onClick={() => setQuickCreate(prev => ({ ...prev, [idx]: { ...prev[idx], selectedItemId: it.id, selectedItemName: it.name, selectedItemUnit: it.unit } }))}
                                            className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-xs text-gray-800 flex items-center gap-1">
                                            <Check className="h-3 w-3 text-teal-400 shrink-0" />
                                            {it.name} <span className="text-gray-400">· {it.unit}</span>
                                          </button>
                                        ))}
                                    </div>
                                  )}
                                  {/* new item: show category+unit when no existing item selected */}
                                  {qc.itemSearch.trim() && (
                                    <div className="flex gap-2 mt-1.5">
                                      <select value={qc.newCategory}
                                        onChange={e => setQuickCreate(prev => ({ ...prev, [idx]: { ...prev[idx], newCategory: e.target.value as ConsumableCategory } }))}
                                        className="flex-1 border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                                        {CONSUMABLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                      </select>
                                      <div className="flex-1">
                                        <input list="scan-unit-list" value={qc.newUnit}
                                          onChange={e => setQuickCreate(prev => ({ ...prev, [idx]: { ...prev[idx], newUnit: e.target.value } }))}
                                          placeholder="單位"
                                          className="w-full border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                        <datalist id="scan-unit-list">
                                          {CONSUMABLE_UNITS.map(u => <option key={u} value={u} />)}
                                        </datalist>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Step 2: 商品名稱（always shown once item determined） */}
                            <div>
                              <label className="text-xs text-gray-400 block mb-0.5">商品名稱</label>
                              <input type="text" value={qc.productName}
                                onChange={e => setQuickCreate(prev => ({ ...prev, [idx]: { ...prev[idx], productName: e.target.value } }))}
                                placeholder="例：荔枝口味、葡萄口味"
                                className="w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            </div>

                            {/* Purchase qty */}
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-400 shrink-0">購入數量</label>
                              <input type="number" min="0.01" step="any" value={qc.purchaseQty}
                                onChange={e => setQuickCreate(prev => ({ ...prev, [idx]: { ...prev[idx], purchaseQty: parseFloat(e.target.value) || 1 } }))}
                                className="w-20 border rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                              <span className="text-xs text-gray-500">
                                {qc.selectedItemId ? qc.selectedItemUnit : (qc.newUnit || '單位')}
                              </span>
                              {(() => {
                                const u = qc.selectedItemId ? qc.selectedItemUnit : qc.newUnit
                                return u && qc.purchaseQty > 0 ? (
                                  <span className="text-xs text-blue-600 ml-auto">
                                    ${(effectivePrice(idx) / qc.purchaseQty).toFixed(2)}/{u}
                                  </span>
                                ) : null
                              })()}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => saveQuickCreate(idx)}
                                disabled={qc.saving || (!qc.selectedItemId && !qc.itemSearch.trim()) || (!qc.selectedItemId && !qc.productName.trim() && !qc.itemSearch.trim())}
                                className="flex-1 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium disabled:opacity-40">
                                {qc.saving ? '建立中…' : '建立並連結'}
                              </button>
                              <button onClick={() => setQuickCreate(prev => { const n = { ...prev }; delete n[idx]; return n })}
                                className="flex-1 py-1.5 rounded-lg border text-xs text-gray-500">取消</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => openPicker(idx)}
                              className="mt-2 flex items-center gap-1 text-xs text-blue-500">
                              {isPickerOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              {isPickerOpen ? '收起' : '連結商品（建立採購紀錄）'}
                            </button>
                            {isPickerOpen && (
                              <div className="mt-2 space-y-2">
                                <input type="text" placeholder="搜尋現有商品…" value={productSearch} autoFocus
                                  onChange={e => setProductSearch(e.target.value)}
                                  className="w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                  {filteredProducts.map(p => (
                                    <button key={p.id} onClick={() => linkProduct(idx, p.id)}
                                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors">
                                      <span className="text-xs font-medium text-gray-800">{p.item_name}</span>
                                      <span className="text-xs text-gray-400 ml-1">· {p.name}</span>
                                    </button>
                                  ))}
                                </div>
                                <button onClick={() => { startQuickCreate(idx, item.name); setPickerOpenIdx(null) }}
                                  className="w-full flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-blue-300 text-blue-500 text-xs hover:bg-blue-50 transition-colors">
                                  <Plus className="h-3.5 w-3.5" />新增「{item.name}」為消耗品
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="px-5 pb-5 pt-2 shrink-0 border-t">
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm text-gray-500">取消</button>
                <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-medium">
                  儲存（{savedRowCount} 筆）
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

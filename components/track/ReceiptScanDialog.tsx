'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { X, Camera, ImagePlus, Loader2, ChevronDown, ChevronUp, Check } from 'lucide-react'
import type { ConsumableProduct } from '@/types'

export type ItemCategory = '食物' | '食物且消耗品' | '用品' | '用品且消耗品'

const CATEGORIES: ItemCategory[] = ['食物', '食物且消耗品', '用品', '用品且消耗品']

const CATEGORY_STYLES: Record<ItemCategory, string> = {
  '食物':       'bg-green-500 text-white border-green-500',
  '食物且消耗品': 'bg-teal-500 text-white border-teal-500',
  '用品':       'bg-orange-400 text-white border-orange-400',
  '用品且消耗品': 'bg-blue-500 text-white border-blue-500',
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
  const [store, setStore] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [products, setProducts] = useState<ProductOption[]>([])
  const [linkedProduct, setLinkedProduct] = useState<Record<number, string>>({})
  const [pickerOpenIdx, setPickerOpenIdx] = useState<number | null>(null)
  const [productSearch, setProductSearch] = useState('')

  useEffect(() => {
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
        })))
      }
    }
    loadProducts()
  }, [profileId])

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handleFile(file: File) {
    setError(null)
    setStep('scanning')
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
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

  function setCategory(idx: number, cat: ItemCategory) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, category: cat } : item))
    if (!isConsumable(cat)) {
      setLinkedProduct(prev => { const n = { ...prev }; delete n[idx]; return n })
      if (pickerOpenIdx === idx) setPickerOpenIdx(null)
    }
  }

  function linkProduct(idx: number, productId: string) {
    setLinkedProduct(prev => ({ ...prev, [idx]: productId }))
    setPickerOpenIdx(null)
    setProductSearch('')
  }

  function unlinkProduct(idx: number) {
    setLinkedProduct(prev => { const n = { ...prev }; delete n[idx]; return n })
  }

  async function handleSave() {
    setStep('saving')
    try {
      const storeVal = store.trim() || '未知通路'
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const productId = linkedProduct[i]

        // 全部存入 receipt_temp_items（供對帳用）
        await supabase.from('receipt_temp_items').insert({
          profile_id: profileId,
          purchase_date: purchaseDate,
          store: storeVal,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          category: item.category,
        })

        // 消耗品且已連結商品 → 同步建採購紀錄
        if (isConsumable(item.category) && productId) {
          await supabase.from('consumable_purchases').insert({
            product_id: productId,
            profile_id: profileId,
            purchase_date: purchaseDate,
            store: storeVal,
            price: item.price,
            quantity: item.quantity,
            is_promotion: false,
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

  const foodTotal = items.filter(i => i.category === '食物' || i.category === '食物且消耗品')
    .reduce((s, i) => s + i.price * i.quantity, 0)
  const goodsTotal = items.filter(i => i.category === '用品' || i.category === '用品且消耗品')
    .reduce((s, i) => s + i.price * i.quantity, 0)
  const linkedCount = Object.keys(linkedProduct).length
  const consumableCount = items.filter(i => isConsumable(i.category)).length

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
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600">{error}</div>
            )}
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1.5">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <p><span className="font-medium text-green-600">食物</span>：食品飲料，計入飲食對帳</p>
                <p><span className="font-medium text-teal-600">食物且消耗品</span>：同上 + 追蹤存量</p>
                <p><span className="font-medium text-orange-500">用品</span>：一次性用品，計入購物對帳</p>
                <p><span className="font-medium text-blue-600">用品且消耗品</span>：同上 + 追蹤存量</p>
              </div>
              <p className="text-gray-400 pt-1">所有品項均儲存，對帳 = 食（1+2）＋購（3+4）</p>
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
                <input type="text" value={store} onChange={e => setStore(e.target.value)} placeholder="例：全聯、好市多"
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
            </div>

            {/* Summary */}
            <div className="px-5 pb-2 flex gap-3 shrink-0 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700">食 ${foodTotal.toFixed(0)}</span>
              <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-600">購 ${goodsTotal.toFixed(0)}</span>
              {consumableCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-600">
                  消耗品 {consumableCount}（連結 {linkedCount}）
                </span>
              )}
            </div>

            {error && (
              <div className="mx-5 mb-2 bg-red-50 border border-red-100 rounded-xl px-4 py-2 text-xs text-red-600 shrink-0">{error}</div>
            )}

            <div className="overflow-y-auto flex-1 px-5 pb-3 space-y-2">
              {items.map((item, idx) => {
                const linked = linkedProduct[idx]
                const linkedProd = products.find(p => p.id === linked)
                const isPickerOpen = pickerOpenIdx === idx
                const consumable = isConsumable(item.category)

                return (
                  <div key={idx} className="bg-gray-50 rounded-2xl border overflow-hidden">
                    <div className="p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                          <p className={`text-xs mt-0.5 ${item.price < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            ${item.price}
                            {item.quantity > 1 && <span className="ml-1">× {item.quantity}</span>}
                          </p>
                        </div>
                      </div>
                      {/* 2x2 category grid */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {CATEGORIES.map(cat => (
                          <button
                            key={cat}
                            onClick={() => setCategory(idx, cat)}
                            className={`py-1.5 text-xs rounded-lg border transition-colors ${
                              item.category === cat ? CATEGORY_STYLES[cat] : 'border-gray-200 text-gray-400 bg-white'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {consumable && (
                      <div className="border-t px-3 pb-2">
                        {linked && linkedProd ? (
                          <div className="flex items-center gap-2 pt-2">
                            <Check className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            <span className="text-xs text-gray-700 flex-1 truncate">
                              {linkedProd.item_name} · {linkedProd.name}
                            </span>
                            <button onClick={() => unlinkProduct(idx)} className="text-xs text-gray-400 underline shrink-0">取消</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setPickerOpenIdx(isPickerOpen ? null : idx); setProductSearch('') }}
                            className="mt-2 flex items-center gap-1 text-xs text-blue-500"
                          >
                            {isPickerOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {isPickerOpen ? '收起' : '連結商品（同步建立採購紀錄）'}
                          </button>
                        )}

                        {isPickerOpen && (
                          <div className="mt-2 space-y-2">
                            <input type="text" placeholder="搜尋商品名稱…" value={productSearch}
                              onChange={e => setProductSearch(e.target.value)} autoFocus
                              className="w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            <div className="max-h-36 overflow-y-auto space-y-1">
                              {filteredProducts.length === 0 ? (
                                <p className="text-xs text-gray-400 py-2 text-center">無符合商品；不連結仍會暫存待處理</p>
                              ) : filteredProducts.map(p => (
                                <button key={p.id} onClick={() => linkProduct(idx, p.id)}
                                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors">
                                  <span className="text-xs font-medium text-gray-800">{p.item_name}</span>
                                  <span className="text-xs text-gray-400 ml-1">· {p.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
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
                  儲存全部（{items.length} 筆）
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

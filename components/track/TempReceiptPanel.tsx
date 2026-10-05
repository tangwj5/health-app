'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { X, Trash2, Check, Link, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import type { ReceiptTempItem, ConsumableProduct, ConsumableCategory } from '@/types'

type Filter = 'all' | '食' | '購' | '消耗品待匯入'

const FOOD_CATS: string[] = ['食物', '食物且消耗品']
const GOODS_CATS: string[] = ['用品', '用品且消耗品']
const CONSUMABLE_CATS: string[] = ['食物且消耗品', '用品且消耗品']

const CONSUMABLE_CATEGORIES: ConsumableCategory[] = ['食品飲料', '保養藥品', '個人護理', '餐廚清潔', '其他']
const CONSUMABLE_UNITS = ['ml', 'g', '顆', '片', '個', '包', '瓶', '罐', '條', '盒', '組', '支', '雙', '件', '份', '次']

function catBadge(cat: string) {
  if (cat === '食物') return 'bg-green-100 text-green-700'
  if (cat === '食物且消耗品') return 'bg-teal-100 text-teal-700'
  if (cat === '用品') return 'bg-orange-100 text-orange-600'
  if (cat === '用品且消耗品') return 'bg-blue-100 text-blue-600'
  return 'bg-gray-100 text-gray-500'
}

function defaultConsumableCategory(itemCat: string): ConsumableCategory {
  return itemCat === '食物且消耗品' ? '食品飲料' : '餐廚清潔'
}

interface ProductOption extends ConsumableProduct {
  item_name: string
}

interface QuickCreate {
  itemName: string
  productName: string
  category: ConsumableCategory
  unit: string
  saving: boolean
}

export function TempReceiptPanel({
  profileId,
  onClose,
}: {
  profileId: string
  onClose: () => void
}) {
  const supabase = createClient()
  const [items, setItems] = useState<ReceiptTempItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  // Linking state
  const [products, setProducts] = useState<ProductOption[]>([])
  const [linkingItem, setLinkingItem] = useState<ReceiptTempItem | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [quickCreate, setQuickCreate] = useState<QuickCreate | null>(null)
  const [linking, setLinking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('receipt_temp_items')
      .select('*')
      .eq('profile_id', profileId)
      .eq('is_processed', false)
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false })
    setItems((data as ReceiptTempItem[]) ?? [])
    setLoading(false)
  }, [profileId])

  const loadProducts = useCallback(async () => {
    const { data } = await supabase
      .from('consumable_products')
      .select('*, consumable_items(name)')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
    if (data) {
      setProducts((data as any[]).map(p => ({ ...p, item_name: p.consumable_items?.name ?? '' })))
    }
  }, [profileId])

  useEffect(() => { load(); loadProducts() }, [load, loadProducts])

  async function markProcessed(id: string) {
    await supabase.from('receipt_temp_items').update({ is_processed: true }).eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function deleteItem(id: string) {
    await supabase.from('receipt_temp_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    setDeleteConfirm(null)
  }

  async function linkToProduct(productId: string) {
    if (!linkingItem) return
    setLinking(true)
    try {
      await supabase
        .from('receipt_temp_items')
        .update({ linked_product_id: productId })
        .eq('id', linkingItem.id)
      await supabase.from('consumable_purchases').insert({
        product_id: productId,
        profile_id: profileId,
        purchase_date: linkingItem.purchase_date,
        store: linkingItem.store ?? '未知通路',
        price: linkingItem.price,
        quantity: linkingItem.quantity,
        is_promotion: false,
        note: linkingItem.name,
      })
      setItems(prev => prev.map(i => i.id === linkingItem.id ? { ...i, linked_product_id: productId } : i))
      setLinkingItem(null)
      setQuickCreate(null)
    } finally {
      setLinking(false)
    }
  }

  async function saveQuickCreate() {
    if (!quickCreate || !linkingItem || !quickCreate.itemName.trim()) return
    setQuickCreate(prev => prev ? { ...prev, saving: true } : null)
    try {
      const { data: itemData } = await supabase
        .from('consumable_items')
        .insert({ profile_id: profileId, name: quickCreate.itemName.trim(), category: quickCreate.category, unit: quickCreate.unit })
        .select().single()
      if (!itemData) throw new Error()
      const { data: prodData } = await supabase
        .from('consumable_products')
        .insert({ item_id: itemData.id, profile_id: profileId, name: quickCreate.productName.trim() || quickCreate.itemName.trim() })
        .select().single()
      if (!prodData) throw new Error()
      setProducts(prev => [{ ...(prodData as ConsumableProduct), item_name: quickCreate.itemName.trim() }, ...prev])
      await linkToProduct(prodData.id)
    } catch {
      setQuickCreate(prev => prev ? { ...prev, saving: false } : null)
    }
  }

  // Totals always use all items regardless of filter
  const foodTotal = items.filter(i => FOOD_CATS.includes(i.category))
    .reduce((s, i) => s + i.price * i.quantity, 0)
  const goodsTotal = items.filter(i => GOODS_CATS.includes(i.category))
    .reduce((s, i) => s + i.price * i.quantity, 0)

  const displayed = (() => {
    if (filter === '食') return items.filter(i => FOOD_CATS.includes(i.category))
    if (filter === '購') return items.filter(i => GOODS_CATS.includes(i.category))
    if (filter === '消耗品待匯入') return items.filter(i => CONSUMABLE_CATS.includes(i.category) && !i.linked_product_id)
    return items
  })()

  const groups: { key: string; date: string; store: string; items: ReceiptTempItem[] }[] = []
  for (const item of displayed) {
    const key = `${item.purchase_date}|${item.store ?? ''}`
    const existing = groups.find(g => g.key === key)
    if (existing) existing.items.push(item)
    else groups.push({ key, date: item.purchase_date, store: item.store ?? '未知通路', items: [item] })
  }

  const consumableUnlinked = items.filter(i => CONSUMABLE_CATS.includes(i.category) && !i.linked_product_id).length
  const filteredProducts = products.filter(p =>
    !productSearch || p.name.includes(productSearch) || p.item_name.includes(productSearch)
  )

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full max-w-lg mx-auto rounded-t-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">待處理明細</h3>
            {!loading && items.length > 0 && (
              <div className="flex gap-3 mt-0.5 text-xs">
                <span className="text-green-600">食 ${foodTotal.toFixed(0)}</span>
                <span className="text-orange-500">購 ${goodsTotal.toFixed(0)}</span>
                <span className="text-gray-400">合計 ${(foodTotal + goodsTotal).toFixed(0)}</span>
              </div>
            )}
          </div>
          <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
        </div>

        <div className="px-5 pb-3 flex gap-2 shrink-0 overflow-x-auto">
          {(['all', '食', '購', '消耗品待匯入'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs border transition-colors ${
                filter === f ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500'
              }`}
            >
              {f === 'all' ? `全部（${items.length}）`
                : f === '消耗品待匯入' ? `消耗品待匯入（${consumableUnlinked}）`
                : f}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">載入中…</div>
          ) : groups.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {items.length === 0 ? '沒有待處理明細' : '此分類無項目'}
            </div>
          ) : groups.map(group => {
            const groupTotal = group.items.reduce((s, i) => s + i.price * i.quantity, 0)
            return (
              <div key={group.key}>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold text-gray-500">
                    {format(parseISO(group.date), 'M/d')} · {group.store}
                  </p>
                  <span className="text-xs text-gray-300">${groupTotal.toFixed(0)}</span>
                </div>
                <div className="space-y-1.5">
                  {group.items.map(item => {
                    const isUnlinkedConsumable = CONSUMABLE_CATS.includes(item.category) && !item.linked_product_id
                    const isLinking = linkingItem?.id === item.id
                    return (
                      <div key={item.id} className="rounded-xl border overflow-hidden">
                        <div className="bg-gray-50 flex items-center gap-2 px-3 py-2.5">
                          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${catBadge(item.category)}`}>
                            {item.category}
                          </span>
                          <span className="flex-1 text-sm text-gray-800 truncate">{item.name}</span>
                          <span className={`text-xs shrink-0 ${item.price < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                            ${item.price}
                            {item.quantity > 1 && <span className="text-gray-400"> ×{item.quantity}</span>}
                          </span>
                          {isUnlinkedConsumable && (
                            <button
                              onClick={() => {
                                if (isLinking) { setLinkingItem(null); setQuickCreate(null) }
                                else { setLinkingItem(item); setProductSearch(''); setQuickCreate(null) }
                              }}
                              className="shrink-0 text-blue-400 hover:text-blue-600 p-0.5 transition-colors"
                              title="連結消耗品"
                            >
                              {isLinking ? <ChevronUp className="h-4 w-4" /> : <Link className="h-4 w-4" />}
                            </button>
                          )}
                          {deleteConfirm === item.id ? (
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => deleteItem(item.id)} className="text-xs text-red-500 px-1.5 py-0.5 rounded border border-red-200">刪</button>
                              <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-400 px-1.5 py-0.5 rounded border border-gray-200">取消</button>
                            </div>
                          ) : (
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => markProcessed(item.id)} title="標記已對帳" className="text-gray-300 hover:text-green-500 p-0.5 transition-colors">
                                <Check className="h-4 w-4" />
                              </button>
                              <button onClick={() => setDeleteConfirm(item.id)} className="text-gray-300 hover:text-red-400 p-0.5 transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Link panel */}
                        {isLinking && (
                          <div className="bg-white border-t px-3 pb-3 pt-2 space-y-2">
                            {!quickCreate ? (
                              <>
                                <input type="text" placeholder="搜尋現有商品…" value={productSearch} autoFocus
                                  onChange={e => setProductSearch(e.target.value)}
                                  className="w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                <div className="max-h-36 overflow-y-auto space-y-1">
                                  {filteredProducts.map(p => (
                                    <button key={p.id} disabled={linking}
                                      onClick={() => linkToProduct(p.id)}
                                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-40">
                                      <span className="text-xs font-medium text-gray-800">{p.item_name}</span>
                                      <span className="text-xs text-gray-400 ml-1">· {p.name}</span>
                                    </button>
                                  ))}
                                </div>
                                <button
                                  onClick={() => setQuickCreate({
                                    itemName: item.name,
                                    productName: item.name,
                                    category: defaultConsumableCategory(item.category),
                                    unit: 'ml',
                                    saving: false,
                                  })}
                                  className="w-full flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-blue-300 text-blue-500 text-xs hover:bg-blue-50 transition-colors"
                                >
                                  <Plus className="h-3.5 w-3.5" />新增「{item.name}」為消耗品
                                </button>
                              </>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-gray-600">新增消耗品</p>
                                <div>
                                  <label className="text-xs text-gray-400 block mb-0.5">品項名稱</label>
                                  <input type="text" value={quickCreate.itemName} autoFocus
                                    onChange={e => setQuickCreate(prev => prev ? { ...prev, itemName: e.target.value } : null)}
                                    className="w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-400 block mb-0.5">商品名稱（選填）</label>
                                  <input type="text" value={quickCreate.productName}
                                    onChange={e => setQuickCreate(prev => prev ? { ...prev, productName: e.target.value } : null)}
                                    className="w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                </div>
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <label className="text-xs text-gray-400 block mb-0.5">類別</label>
                                    <select value={quickCreate.category}
                                      onChange={e => setQuickCreate(prev => prev ? { ...prev, category: e.target.value as ConsumableCategory } : null)}
                                      className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                                      {CONSUMABLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-xs text-gray-400 block mb-0.5">單位</label>
                                    <input list="temp-unit-list" value={quickCreate.unit}
                                      onChange={e => setQuickCreate(prev => prev ? { ...prev, unit: e.target.value } : null)}
                                      placeholder="輸入單位"
                                      className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                    <datalist id="temp-unit-list">
                                      {CONSUMABLE_UNITS.map(u => <option key={u} value={u} />)}
                                    </datalist>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={saveQuickCreate} disabled={quickCreate.saving || !quickCreate.itemName.trim()}
                                    className="flex-1 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium disabled:opacity-40">
                                    {quickCreate.saving ? '建立中…' : '建立並連結'}
                                  </button>
                                  <button onClick={() => setQuickCreate(null)}
                                    className="flex-1 py-1.5 rounded-lg border text-xs text-gray-500">返回搜尋</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

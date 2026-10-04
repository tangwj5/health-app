'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { BottomNav } from '@/components/layout/BottomNav'
import { ChevronLeft, Plus, Pencil, Trash2, Star, X } from 'lucide-react'
import { format, parseISO, addDays } from 'date-fns'
import type { ConsumableItem, ConsumableProduct, ConsumablePurchase } from '@/types'

const DEFAULT_STORES = ['好市多', '全聯', '7-11', '全家']

function PurchaseDialog({
  productId,
  profileId,
  productName,
  initial,
  onClose,
  onSaved,
}: {
  productId: string
  profileId: string
  productName: string
  initial?: ConsumablePurchase
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [date, setDate] = useState(initial?.purchase_date ?? format(new Date(), 'yyyy-MM-dd'))
  const [store, setStore] = useState(() => {
    if (!initial) return ''
    return DEFAULT_STORES.includes(initial.store) ? initial.store : '__custom__'
  })
  const [customStore, setCustomStore] = useState(() => {
    if (!initial) return ''
    return DEFAULT_STORES.includes(initial.store) ? '' : initial.store
  })
  const [price, setPrice] = useState(initial?.price.toString() ?? '')
  const [quantity, setQuantity] = useState(initial?.quantity.toString() ?? '1')
  const [isPromo, setIsPromo] = useState(initial?.is_promotion ?? false)
  const [note, setNote] = useState(initial?.note ?? '')
  const [saving, setSaving] = useState(false)

  const finalStore = store === '__custom__' ? customStore : store

  async function save() {
    if (!finalStore.trim() || !price) return
    setSaving(true)
    const payload = {
      purchase_date: date,
      store: finalStore.trim(),
      price: parseFloat(price),
      quantity: parseInt(quantity) || 1,
      is_promotion: isPromo,
      note: note.trim() || null,
    }
    if (initial) {
      await supabase.from('consumable_purchases').update(payload).eq('id', initial.id)
    } else {
      await supabase.from('consumable_purchases').insert({ ...payload, product_id: productId, profile_id: profileId })
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full max-w-lg mx-auto rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">{initial ? '編輯購買紀錄' : '新增購買紀錄'}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-500 -mt-2">{productName}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">購買日期</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">購買通路</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {DEFAULT_STORES.map(s => (
                <button key={s} onClick={() => setStore(s)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${store === s ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-500'}`}
                >{s}</button>
              ))}
              <button onClick={() => setStore('__custom__')}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${store === '__custom__' ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-500'}`}
              >其他</button>
            </div>
            {store === '__custom__' && (
              <input type="text" value={customStore} onChange={e => setCustomStore(e.target.value)}
                placeholder="輸入通路名稱"
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">售價（NT$）</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)}
              placeholder="0"
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">數量</label>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
              min="1"
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isPromo} onChange={e => setIsPromo(e.target.checked)}
            className="w-4 h-4 rounded accent-orange-500" />
          <span className="text-sm text-gray-600">特價</span>
          <Star className="h-3.5 w-3.5 text-orange-400" />
        </label>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">備註（選填）</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm text-gray-500">取消</button>
          <button onClick={save} disabled={saving || !finalStore.trim() || !price}
            className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-medium disabled:opacity-50">
            {saving ? '儲存中…' : initial ? '儲存' : '新增'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Simple SVG price trend chart
function PriceChart({ purchases, unit, capacity }: {
  purchases: ConsumablePurchase[]
  unit: string
  capacity: number | null
}) {
  const sorted = [...purchases].sort((a, b) => a.purchase_date.localeCompare(b.purchase_date))
  if (sorted.length < 2) return null

  const toUnitPrice = (p: ConsumablePurchase) =>
    capacity ? p.price / (capacity * p.quantity) : p.price / p.quantity

  const points = sorted.map(p => ({
    date: parseISO(p.purchase_date),
    value: toUnitPrice(p),
    isPromo: p.is_promotion,
  }))

  const W = 320, H = 140, PAD = 30
  const minV = Math.min(...points.map(p => p.value))
  const maxV = Math.max(...points.map(p => p.value))
  const range = maxV - minV || 1

  const minT = points[0].date.getTime()
  const maxT = points[points.length - 1].date.getTime()
  const tSpan = maxT - minT || 1

  const px = (t: number) => PAD + ((t - minT) / tSpan) * (W - PAD * 2)
  const py = (v: number) => (H - PAD) - ((v - minV) / range) * (H - PAD * 2)

  const label = capacity ? `NT$ / ${unit}` : `NT$ / 件`

  return (
    <div className="bg-white rounded-2xl border p-4">
      <p className="text-sm font-semibold text-gray-700 mb-3">單價趨勢（{label}）</p>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        {/* Gridlines */}
        {[0, 0.5, 1].map(r => {
          const v = minV + r * range
          const y = py(v)
          return (
            <g key={r}>
              <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#f0f0f0" strokeWidth="1" />
              <text x={PAD - 4} y={y + 4} fontSize="8" fill="#aaa" textAnchor="end">
                {capacity ? v.toFixed(3) : v.toFixed(1)}
              </text>
            </g>
          )
        })}

        {/* Line */}
        <polyline
          points={points.map(p => `${px(p.date.getTime())},${py(p.value)}`).join(' ')}
          fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round"
        />

        {/* Dots */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={px(p.date.getTime())} cy={py(p.value)} r={4}
              fill={p.isPromo ? '#f97316' : '#22c55e'}
              stroke="white" strokeWidth="1.5"
            />
          </g>
        ))}

        {/* X labels */}
        {points.map((p, i) => {
          if (points.length > 6 && i % Math.ceil(points.length / 6) !== 0 && i !== points.length - 1) return null
          return (
            <text key={i} x={px(p.date.getTime())} y={H - 4} fontSize="8" fill="#aaa" textAnchor="middle">
              {format(p.date, 'M/d')}
            </text>
          )
        })}
      </svg>
      <p className="text-xs text-gray-400 mt-1">橘點為特價</p>
    </div>
  )
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const itemId = params.itemId as string
  const productId = params.productId as string
  const supabase = createClient()
  const { profiles, activeSlot } = useAppStore()
  const profile = profiles.find(p => p.slot === activeSlot) ?? profiles[0] ?? null

  const [item, setItem] = useState<ConsumableItem | null>(null)
  const [product, setProduct] = useState<ConsumableProduct | null>(null)
  const [purchases, setPurchases] = useState<ConsumablePurchase[]>([])
  const [showAddPurchase, setShowAddPurchase] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState<ConsumablePurchase | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: itemData }, { data: prodData }, { data: purData }] = await Promise.all([
      supabase.from('consumable_items').select('*').eq('id', itemId).single(),
      supabase.from('consumable_products').select('*').eq('id', productId).single(),
      supabase.from('consumable_purchases').select('*').eq('product_id', productId)
        .order('purchase_date', { ascending: false }),
    ])
    if (itemData) setItem(itemData as ConsumableItem)
    if (prodData) setProduct(prodData as ConsumableProduct)
    setPurchases((purData as ConsumablePurchase[]) || [])
  }, [itemId, productId])

  useEffect(() => { load() }, [load])

  async function deletePurchase(id: string) {
    await supabase.from('consumable_purchases').delete().eq('id', id)
    setPurchases(prev => prev.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  if (!item || !product) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-sm text-gray-400">載入中…</p>
    </div>
  )

  const unit = item.unit
  const toUnitPrice = (p: ConsumablePurchase) =>
    product.capacity ? (p.price / (product.capacity * p.quantity)).toFixed(3) : null

  const avgInterval = (() => {
    if (purchases.length < 2) return null
    const sorted = [...purchases].sort((a, b) => a.purchase_date.localeCompare(b.purchase_date))
    let total = 0
    for (let i = 1; i < sorted.length; i++) {
      total += (parseISO(sorted[i].purchase_date).getTime() - parseISO(sorted[i - 1].purchase_date).getTime()) / 86400000
    }
    return Math.round(total / (sorted.length - 1))
  })()

  const latest = purchases[0]
  const nextBuy = latest && product.estimated_days
    ? addDays(parseISO(latest.purchase_date), product.estimated_days) : null
  const daysLeft = nextBuy ? Math.ceil((nextBuy.getTime() - Date.now()) / 86400000) : null

  const allPrices = purchases.map(p => p.price / p.quantity)
  const minPrice = allPrices.length ? Math.min(...allPrices) : null
  const maxPrice = allPrices.length ? Math.max(...allPrices) : null

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold text-gray-800 truncate">{product.name}</h1>
              <p className="text-xs text-gray-400">
                {product.brand && `${product.brand}・`}
                {product.capacity && `${product.capacity}${unit}・`}
                {item.name}
              </p>
            </div>
            <button
              onClick={() => setShowAddPurchase(true)}
              className="flex items-center gap-1 text-xs text-green-600 font-medium shrink-0"
            >
              <Plus className="h-4 w-4" />記錄購買
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

        {/* Stats */}
        <div className="bg-white rounded-2xl border p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-base font-bold text-green-700">{purchases.length}</p>
              <p className="text-xs text-gray-400">購買次數</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-base font-bold text-blue-700">{avgInterval ?? '—'}</p>
              <p className="text-xs text-gray-400">平均間隔天</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3">
              <p className={`text-base font-bold ${daysLeft != null && daysLeft <= 7 ? 'text-red-500' : daysLeft != null && daysLeft <= 14 ? 'text-orange-500' : 'text-orange-700'}`}>
                {daysLeft != null ? (daysLeft <= 0 ? '該買了' : `${daysLeft}天`) : '—'}
              </p>
              <p className="text-xs text-gray-400">距下次購買</p>
            </div>
          </div>
          {(minPrice != null || product.note) && (
            <div className="mt-3 pt-3 border-t space-y-1">
              {minPrice != null && (
                <p className="text-xs text-gray-500">
                  歷史最低 <span className="font-semibold text-green-600">NT${minPrice.toFixed(0)}</span>
                  {maxPrice !== minPrice && <span className="text-gray-400"> ／ 最高 NT${maxPrice!.toFixed(0)}</span>}
                </p>
              )}
              {product.note && <p className="text-xs text-gray-500">{product.note}</p>}
            </div>
          )}
        </div>

        {/* Chart */}
        <PriceChart purchases={[...purchases].reverse()} unit={unit} capacity={product.capacity} />

        {/* Purchase history */}
        <div className="bg-white rounded-2xl border p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">購買紀錄</p>
          {purchases.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">尚無紀錄</p>
          ) : (
            <div className="space-y-2">
              {purchases.map(p => {
                const up = toUnitPrice(p)
                return (
                  <div key={p.id} className="py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-gray-700">
                            NT${p.price}{p.quantity > 1 && ` × ${p.quantity}`}
                          </span>
                          {up && <span className="text-xs text-gray-400">{up}/{unit}</span>}
                          {p.is_promotion && (
                            <span className="text-xs text-orange-500 font-medium flex items-center gap-0.5">
                              <Star className="h-3 w-3" />特價
                            </span>
                          )}
                          <span className="text-xs text-gray-400">{p.store}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{format(parseISO(p.purchase_date), 'yyyy/M/d')}</p>
                        {p.note && <p className="text-xs text-gray-400">{p.note}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setEditingPurchase(p)} className="p-1 text-gray-300 hover:text-gray-500">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setConfirmDelete(p.id)} className="p-1 text-gray-300 hover:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {confirmDelete === p.id && (
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => deletePurchase(p.id)}
                          className="flex-1 py-1 rounded-lg bg-red-500 text-white text-xs font-medium">確認刪除</button>
                        <button onClick={() => setConfirmDelete(null)}
                          className="flex-1 py-1 rounded-lg border text-xs text-gray-500">取消</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showAddPurchase && (
        <PurchaseDialog
          productId={productId}
          profileId={profile!.id}
          productName={product.name}
          onClose={() => setShowAddPurchase(false)}
          onSaved={() => { setShowAddPurchase(false); load() }}
        />
      )}
      {editingPurchase && (
        <PurchaseDialog
          productId={productId}
          profileId={profile!.id}
          productName={product.name}
          initial={editingPurchase}
          onClose={() => setEditingPurchase(null)}
          onSaved={() => { setEditingPurchase(null); load() }}
        />
      )}

      <BottomNav />
    </div>
  )
}

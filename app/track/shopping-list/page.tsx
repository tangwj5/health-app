'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { BottomNav } from '@/components/layout/BottomNav'
import { ChevronLeft, ShoppingCart, PackageOpen, PackageCheck, Plus, X, ChevronRight } from 'lucide-react'
import { format, parseISO, addDays, differenceInCalendarDays } from 'date-fns'
import type { ConsumableItem, ConsumableProduct, ConsumablePurchase, ConsumableUsageLog } from '@/types'

const DEFAULT_STORES = ['好市多', '全聯', '7-11', '全家']

interface RestockItem {
  item: ConsumableItem
  products: Array<{
    product: ConsumableProduct
    latestPurchase?: ConsumablePurchase
    avgInterval?: number
    avgUsageDays?: number
    effectiveDays?: number
    nextBuyDate?: Date
    daysUntil?: number
  }>
}

function QuickPurchaseDialog({
  product,
  profileId,
  onClose,
  onSaved,
}: {
  product: ConsumableProduct
  profileId: string
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [store, setStore] = useState('')
  const [customStore, setCustomStore] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [saving, setSaving] = useState(false)
  const finalStore = store === '__custom__' ? customStore : store

  async function save() {
    if (!finalStore.trim() || !price) return
    setSaving(true)
    await supabase.from('consumable_purchases').insert({
      product_id: product.id,
      profile_id: profileId,
      purchase_date: date,
      store: finalStore.trim(),
      price: parseFloat(price),
      quantity: parseFloat(quantity) || 1,
      is_promotion: false,
      note: null,
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full max-w-lg mx-auto rounded-t-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">新增購買紀錄</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-500 -mt-2">{product.name}</p>
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
                placeholder="輸入通路名稱" autoFocus
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              數量（{product.package_unit?.trim() || '包'}）
            </label>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
              min="0.01" step="any"
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">價格</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)}
              placeholder="0"
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm text-gray-500">取消</button>
          <button onClick={save} disabled={saving || !finalStore.trim() || !price}
            className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-medium disabled:opacity-50">
            {saving ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ShoppingListPage() {
  const router = useRouter()
  const supabase = createClient()
  const { profiles, activeSlot } = useAppStore()
  const profile = profiles.find(p => p.slot === activeSlot) ?? profiles[0] ?? null
  const [items, setItems] = useState<RestockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [quickPurchase, setQuickPurchase] = useState<ConsumableProduct | null>(null)

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)

    const { data: trackItems } = await supabase
      .from('consumable_items')
      .select('*')
      .eq('profile_id', profile.id)
      .eq('track_restock', true)
      .order('name')

    if (!trackItems?.length) { setItems([]); setLoading(false); return }

    const itemIds = trackItems.map(i => i.id)

    const [{ data: products }, { data: purchases }, { data: usageLogs }] = await Promise.all([
      supabase.from('consumable_products').select('*').in('item_id', itemIds).eq('profile_id', profile.id),
      supabase.from('consumable_purchases').select('*').eq('profile_id', profile.id).order('purchase_date', { ascending: false }),
      supabase.from('consumable_usage_logs').select('*').eq('profile_id', profile.id).order('logged_at', { ascending: true }),
    ])

    const productMap = new Map<string, ConsumableProduct[]>()
    for (const p of products ?? []) {
      const arr = productMap.get(p.item_id) ?? []
      arr.push(p)
      productMap.set(p.item_id, arr)
    }

    const purchasesByProduct = new Map<string, ConsumablePurchase[]>()
    for (const p of purchases ?? []) {
      const arr = purchasesByProduct.get(p.product_id) ?? []
      arr.push(p)
      purchasesByProduct.set(p.product_id, arr)
    }

    const logsByProduct = new Map<string, ConsumableUsageLog[]>()
    for (const l of usageLogs ?? []) {
      const arr = logsByProduct.get(l.product_id) ?? []
      arr.push(l)
      logsByProduct.set(l.product_id, arr)
    }

    const result: RestockItem[] = trackItems.map(item => {
      const prods = productMap.get(item.id) ?? []
      const enriched = prods.map(product => {
        const productPurchases = purchasesByProduct.get(product.id) ?? []
        const latestPurchase = productPurchases[0]

        // avg interval from purchase history
        let avgInterval: number | undefined
        if (productPurchases.length >= 2) {
          const sorted = [...productPurchases].sort((a, b) =>
            a.purchase_date.localeCompare(b.purchase_date)
          )
          const intervals: number[] = []
          for (let i = 1; i < sorted.length; i++) {
            intervals.push(differenceInCalendarDays(
              parseISO(sorted[i].purchase_date),
              parseISO(sorted[i - 1].purchase_date)
            ))
          }
          if (intervals.length) avgInterval = Math.round(intervals.reduce((s, d) => s + d, 0) / intervals.length)
        }

        // avg usage days from open→finish pairs
        const logs = logsByProduct.get(product.id) ?? []
        let avgUsageDays: number | undefined
        const durations: number[] = []
        let openDate: string | null = null
        for (const log of logs) {
          if (log.action === 'opened') { openDate = log.logged_at }
          else if (log.action === 'finished' && openDate) {
            durations.push(differenceInCalendarDays(parseISO(log.logged_at), parseISO(openDate)))
            openDate = null
          }
        }
        if (durations.length) avgUsageDays = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)

        const effectiveDays = product.estimated_days ?? avgUsageDays ?? avgInterval
        let nextBuyDate: Date | undefined
        let daysUntil: number | undefined
        if (latestPurchase && effectiveDays) {
          nextBuyDate = addDays(parseISO(latestPurchase.purchase_date), effectiveDays)
          daysUntil = differenceInCalendarDays(nextBuyDate, new Date())
        }

        return { product, latestPurchase, avgInterval, avgUsageDays, effectiveDays, nextBuyDate, daysUntil }
      })

      return { item: item as ConsumableItem, products: enriched }
    })

    // sort items: those with overdue/urgent products first
    result.sort((a, b) => {
      const urgencyA = Math.min(...a.products.map(p => p.daysUntil ?? Infinity))
      const urgencyB = Math.min(...b.products.map(p => p.daysUntil ?? Infinity))
      return urgencyA - urgencyB
    })

    setItems(result)
    setLoading(false)
  }, [profile, supabase])

  useEffect(() => { load() }, [load])

  async function logUsage(productId: string, action: 'opened' | 'finished') {
    if (!profile) return
    await supabase.from('consumable_usage_logs').insert({
      profile_id: profile.id,
      product_id: productId,
      action,
      logged_at: new Date().toISOString(),
      note: null,
    })
    load()
  }

  function urgencyColor(daysUntil: number | undefined) {
    if (daysUntil === undefined) return 'text-gray-300'
    if (daysUntil < 0) return 'text-red-500'
    if (daysUntil <= 7) return 'text-orange-400'
    if (daysUntil <= 14) return 'text-yellow-500'
    return 'text-gray-400'
  }

  function urgencyLabel(daysUntil: number | undefined) {
    if (daysUntil === undefined) return '無預估'
    if (daysUntil < 0) return `逾期 ${Math.abs(daysUntil)} 天`
    if (daysUntil === 0) return '今天'
    return `${daysUntil} 天後`
  }

  if (!profile) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
          <button onClick={() => router.push('/track?tab=消耗品')}
            className="p-1 text-gray-400 hover:text-gray-600 -ml-1">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <ShoppingCart className="h-4 w-4 text-purple-500" />
          <h1 className="text-base font-semibold text-gray-800">補貨清單</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">載入中…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">沒有追蹤補貨的品項</p>
            <p className="text-xs mt-1">在品項頁面開啟補貨追蹤</p>
          </div>
        ) : (
          items.map(({ item, products }) => {
            const minDays = Math.min(...products.map(p => p.daysUntil ?? Infinity))
            const overallUrgency = minDays === Infinity ? undefined : minDays
            return (
              <div key={item.id} className="bg-white rounded-2xl border overflow-hidden">
                <div className="flex items-center px-4 py-3 border-b bg-gray-50">
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{item.category}</span>
                  </div>
                  {overallUrgency !== undefined && (
                    <span className={`text-xs font-medium ${urgencyColor(overallUrgency)}`}>
                      {urgencyLabel(overallUrgency)}
                    </span>
                  )}
                  <button onClick={() => router.push(`/track/${item.id}`)}
                    className="ml-2 text-gray-300 hover:text-gray-500">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="divide-y">
                  {products.map(({ product, latestPurchase, effectiveDays, nextBuyDate, daysUntil, avgUsageDays, avgInterval }) => (
                    <div key={product.id} className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{product.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {nextBuyDate ? (
                              <span className={`text-xs ${urgencyColor(daysUntil)}`}>
                                預計 {format(nextBuyDate, 'M/d')} 補貨
                                {daysUntil !== undefined && (
                                  <span className="ml-1 opacity-70">（{urgencyLabel(daysUntil)}）</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">尚無補貨預估</span>
                            )}
                            {latestPurchase && (
                              <span className="text-xs text-gray-300">
                                上次 {format(parseISO(latestPurchase.purchase_date), 'M/d')} @ {latestPurchase.store}
                              </span>
                            )}
                          </div>
                          {(avgUsageDays || avgInterval) && (
                            <p className="text-xs text-gray-300 mt-0.5">
                              {effectiveDays === product.estimated_days && product.estimated_days
                                ? `設定週期 ${product.estimated_days} 天`
                                : avgUsageDays
                                  ? `平均使用 ${avgUsageDays} 天`
                                  : `購買間隔 ${avgInterval} 天`}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => logUsage(product.id, 'opened')}
                            title="記錄開封"
                            className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-50 transition-colors"
                          >
                            <PackageOpen className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => logUsage(product.id, 'finished')}
                            title="記錄用完"
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                          >
                            <PackageCheck className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setQuickPurchase(product)}
                            title="新增購買"
                            className="p-1.5 rounded-lg text-green-500 hover:bg-green-50 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {products.length === 0 && (
                    <div className="px-4 py-3 text-xs text-gray-400">
                      尚無商品，
                      <button onClick={() => router.push(`/track/${item.id}`)}
                        className="text-green-500 underline">
                        前往新增
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {quickPurchase && (
        <QuickPurchaseDialog
          product={quickPurchase}
          profileId={profile.id}
          onClose={() => setQuickPurchase(null)}
          onSaved={() => { setQuickPurchase(null); load() }}
        />
      )}

      <BottomNav />
    </div>
  )
}

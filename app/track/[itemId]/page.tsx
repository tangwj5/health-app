'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { BottomNav } from '@/components/layout/BottomNav'
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, X, Star, Camera, Package } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO, addDays } from 'date-fns'
import type { ConsumableItem, ConsumableProduct, ConsumablePurchase } from '@/types'

const DEFAULT_STORES = ['好市多', '全聯', '7-11', '全家']

interface PurchaseStat {
  price: number
  store: string
  purchaseQty: number
}

interface ProductWithLatest extends ConsumableProduct {
  latestPurchase?: Pick<ConsumablePurchase, 'purchase_date' | 'price' | 'store'>
  avgUnitPrice?: number
  minPurchase?: PurchaseStat
  purchaseCount: number
}

function ProductDialog({
  itemId,
  profileId,
  unit,
  initial,
  onClose,
  onSaved,
}: {
  itemId: string
  profileId: string
  unit: string
  initial?: ConsumableProduct
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [name, setName] = useState(initial?.name ?? '')
  const [brand, setBrand] = useState(initial?.brand ?? '')
  const [capacity, setCapacity] = useState(initial?.capacity?.toString() ?? '')
  const [estimatedDays, setEstimatedDays] = useState(initial?.estimated_days?.toString() ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [photoUrl, setPhotoUrl] = useState(initial?.photo_url ?? '')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handlePhotoUpload(file: File) {
    setUploadingPhoto(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${profileId}/${(Math.random().toString(36).slice(2))}.${ext}`
    const { data, error } = await supabase.storage
      .from('consumable-photos')
      .upload(path, file, { upsert: true })
    if (!error && data) {
      const { data: { publicUrl } } = supabase.storage.from('consumable-photos').getPublicUrl(data.path)
      setPhotoUrl(publicUrl)
    }
    setUploadingPhoto(false)
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const payload = {
      name: name.trim(),
      brand: brand.trim() || null,
      capacity: capacity ? parseFloat(capacity) : null,
      estimated_days: estimatedDays ? parseInt(estimatedDays) : null,
      note: note.trim() || null,
      photo_url: photoUrl || null,
    }
    if (initial) {
      await supabase.from('consumable_products').update(payload).eq('id', initial.id)
    } else {
      await supabase.from('consumable_products').insert({ ...payload, item_id: itemId, profile_id: profileId })
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full max-w-lg mx-auto rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">{initial ? '編輯商品' : '新增商品'}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">商品照片（選填）</label>
            <div className="flex items-center gap-3">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="w-16 h-16 rounded-xl object-cover border" />
              ) : (
                <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center shrink-0">
                  <Package className="h-6 w-6 text-gray-300" />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${uploadingPhoto ? 'opacity-50 pointer-events-none' : 'hover:bg-gray-50'}`}>
                  <Camera className="h-3.5 w-3.5" />
                  {uploadingPhoto ? '上傳中…' : '選擇照片'}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }} />
                </label>
                {photoUrl && (
                  <button onClick={() => setPhotoUrl('')} className="text-xs text-red-400 hover:text-red-600 text-left">移除照片</button>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">商品名稱</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="例：Finish Powerball 50顆"
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">品牌（選填）</label>
            <input type="text" value={brand} onChange={e => setBrand(e.target.value)}
              placeholder="例：Finish"
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">容量（{unit}，選填）</label>
            <input type="number" value={capacity} onChange={e => setCapacity(e.target.value)}
              placeholder="例：400"
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">預估使用天數（選填）</label>
            <input type="number" value={estimatedDays} onChange={e => setEstimatedDays(e.target.value)}
              placeholder="例：60（一瓶用兩個月）"
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">心得（選填）</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="使用感受、推薦程度…"
              rows={2}
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm text-gray-500">取消</button>
          <button onClick={save} disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-medium disabled:opacity-50">
            {saving ? '儲存中…' : initial ? '儲存' : '新增'}
          </button>
        </div>
      </div>
    </div>
  )
}

function QuickPurchaseDialog({
  productId,
  profileId,
  productName,
  onClose,
  onSaved,
}: {
  productId: string
  profileId: string
  productName: string
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [store, setStore] = useState('')
  const [customStore, setCustomStore] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [isPromo, setIsPromo] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const finalStore = store === '__custom__' ? customStore : store

  async function save() {
    if (!finalStore.trim() || !price) return
    setSaving(true)
    await supabase.from('consumable_purchases').insert({
      product_id: productId,
      profile_id: profileId,
      purchase_date: date,
      store: finalStore.trim(),
      price: parseFloat(price),
      quantity: parseInt(quantity) || 1,
      is_promotion: isPromo,
      note: note.trim() || null,
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full max-w-lg mx-auto rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">新增購買紀錄</h3>
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
            placeholder=""
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm text-gray-500">取消</button>
          <button onClick={save} disabled={saving || !finalStore.trim() || !price}
            className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-medium disabled:opacity-50">
            {saving ? '儲存中…' : '新增'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ItemDetailPage() {
  const params = useParams()
  const router = useRouter()
  const itemId = params.itemId as string
  const supabase = createClient()
  const { profiles, activeSlot } = useAppStore()
  const profile = profiles.find(p => p.slot === activeSlot) ?? profiles[0] ?? null

  const [item, setItem] = useState<ConsumableItem | null>(null)
  const [products, setProducts] = useState<ProductWithLatest[]>([])
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ConsumableProduct | null>(null)
  const [quickPurchaseProduct, setQuickPurchaseProduct] = useState<ConsumableProduct | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!profile) return
    const { data: itemData } = await supabase
      .from('consumable_items').select('*').eq('id', itemId).single()
    if (!itemData) return
    setItem(itemData as ConsumableItem)

    const { data: prodData } = await supabase
      .from('consumable_products').select('*')
      .eq('item_id', itemId).order('name')

    if (!prodData || prodData.length === 0) { setProducts([]); return }

    const { data: purchaseData } = await supabase
      .from('consumable_purchases').select('product_id, purchase_date, price, quantity, store')
      .in('product_id', (prodData as ConsumableProduct[]).map(p => p.id))
      .order('purchase_date', { ascending: false })

    const latestByProduct: Record<string, Pick<ConsumablePurchase, 'purchase_date' | 'price' | 'store'>> = {}
    const purchasesByProduct: Record<string, Array<{ price: number; quantity: number; store: string; purchase_date: string }>> = {}

    for (const pur of purchaseData || []) {
      if (!latestByProduct[pur.product_id]) latestByProduct[pur.product_id] = pur
      if (!purchasesByProduct[pur.product_id]) purchasesByProduct[pur.product_id] = []
      purchasesByProduct[pur.product_id].push(pur)
    }

    setProducts((prodData as ConsumableProduct[]).map(p => {
      const purs = purchasesByProduct[p.id] || []
      const unitPriceEntries = purs
        .filter(pur => pur.quantity > 0)
        .map(pur => ({ unitPrice: pur.price / pur.quantity, price: pur.price, store: pur.store, purchaseQty: pur.quantity }))
      const avgUnitPrice = unitPriceEntries.length
        ? unitPriceEntries.reduce((sum, x) => sum + x.unitPrice, 0) / unitPriceEntries.length
        : undefined
      const minEntry = unitPriceEntries.length
        ? unitPriceEntries.reduce((best, x) => x.unitPrice < best.unitPrice ? x : best)
        : undefined
      return {
        ...p,
        latestPurchase: latestByProduct[p.id],
        avgUnitPrice,
        minPurchase: minEntry ? { price: minEntry.price, store: minEntry.store, purchaseQty: minEntry.purchaseQty } : undefined,
        purchaseCount: purs.length,
      }
    }))
  }, [profile?.id, itemId])

  useEffect(() => { if (profile) load() }, [load])

  async function deleteProduct(id: string) {
    await supabase.from('consumable_products').delete().eq('id', id)
    load()
    setConfirmDelete(null)
  }

  if (!item) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-sm text-gray-400">載入中…</p>
    </div>
  )

  const unit = item.unit

  function latestUnitPrice(p: ProductWithLatest) {
    if (!p.latestPurchase || !p.capacity) return null
    return (p.latestPurchase.price / p.capacity).toFixed(2)
  }

  function nextBuyDate(p: ProductWithLatest) {
    if (!p.latestPurchase || !p.estimated_days) return null
    return addDays(parseISO(p.latestPurchase.purchase_date), p.estimated_days)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/track?tab=消耗品')} className="text-gray-400 hover:text-gray-600">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-base font-semibold text-gray-800">{item.name}</h1>
              <p className="text-xs text-gray-400">{item.category}・單位：{unit}</p>
            </div>
            <button
              onClick={() => setShowAddProduct(true)}
              className="flex items-center gap-1 text-xs text-green-600 font-medium"
            >
              <Plus className="h-4 w-4" />新增商品
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {products.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">尚無商品，點右上角新增</p>
          </div>
        ) : products.map(prod => {
          const up = latestUnitPrice(prod)
          const nextDate = nextBuyDate(prod)
          const daysLeft = nextDate ? Math.ceil((nextDate.getTime() - Date.now()) / 86400000) : null
          const minUnitPrice = prod.minPurchase && prod.minPurchase.purchaseQty > 0
            ? prod.minPurchase.price / prod.minPurchase.purchaseQty
            : null

          return (
            <div key={prod.id} className="bg-white rounded-2xl border">
              <Link href={`/track/${itemId}/${prod.id}`} className="flex items-start gap-3 p-4">
                {prod.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={prod.photo_url} alt="" className="w-14 h-14 rounded-xl object-cover border shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gray-50 border flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-800">{prod.name}</p>
                    {prod.brand && <span className="text-xs text-gray-400">{prod.brand}</span>}
                    {prod.capacity && <span className="text-xs text-gray-400">{prod.capacity}{unit}</span>}
                  </div>
                  {prod.latestPurchase ? (
                    <div className="mt-1 space-y-0.5">
                      <p className="text-xs text-gray-500">
                        最近：<span className="font-semibold text-gray-700">NT${prod.latestPurchase.price}</span>
                        {up && <span className="ml-1 text-gray-400">（{up}/{unit}）</span>}
                        <span className="ml-1 text-gray-400">@ {prod.latestPurchase.store}</span>
                      </p>
                      {prod.purchaseCount > 1 && (
                        <div className="flex gap-3 text-xs text-gray-400">
                          {prod.avgUnitPrice !== undefined && (
                            <span>均 NT${prod.avgUnitPrice.toFixed(2)}/{unit}</span>
                          )}
                          {minUnitPrice !== null && prod.minPurchase && (
                            <span className="text-green-600">
                              最低 NT${minUnitPrice.toFixed(2)}/{unit} @ {prod.minPurchase.store}
                            </span>
                          )}
                        </div>
                      )}
                      {daysLeft != null && (
                        <p className={`text-xs font-medium ${daysLeft <= 7 ? 'text-red-500' : daysLeft <= 14 ? 'text-orange-500' : 'text-gray-400'}`}>
                          {daysLeft <= 0 ? '建議已到購買時機' : `約 ${daysLeft} 天後購買`}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">尚無購買紀錄</p>
                  )}
                  {prod.note && <p className="text-xs text-gray-400 mt-1 truncate">{prod.note}</p>}
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 shrink-0 mt-0.5" />
              </Link>

              <div className="flex border-t divide-x">
                <button
                  onClick={() => setQuickPurchaseProduct(prod)}
                  className="flex-1 py-2 text-xs text-green-600 font-medium hover:bg-green-50 transition-colors rounded-bl-2xl"
                >
                  + 記錄購買
                </button>
                <button
                  onClick={() => setEditingProduct(prod)}
                  className="px-4 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setConfirmDelete(prod.id)}
                  className="px-4 py-2 text-xs text-gray-400 hover:text-red-400 hover:bg-red-50 transition-colors rounded-br-2xl"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {confirmDelete === prod.id && (
                <div className="flex gap-2 p-3 border-t">
                  <button onClick={() => deleteProduct(prod.id)}
                    className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium">確認刪除</button>
                  <button onClick={() => setConfirmDelete(null)}
                    className="flex-1 py-1.5 rounded-lg border text-xs text-gray-500">取消</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showAddProduct && (
        <ProductDialog
          itemId={itemId}
          profileId={profile!.id}
          unit={unit}
          onClose={() => setShowAddProduct(false)}
          onSaved={() => { setShowAddProduct(false); load() }}
        />
      )}
      {editingProduct && (
        <ProductDialog
          itemId={itemId}
          profileId={profile!.id}
          unit={unit}
          initial={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={() => { setEditingProduct(null); load() }}
        />
      )}
      {quickPurchaseProduct && (
        <QuickPurchaseDialog
          productId={quickPurchaseProduct.id}
          profileId={profile!.id}
          productName={quickPurchaseProduct.name}
          onClose={() => setQuickPurchaseProduct(null)}
          onSaved={() => { setQuickPurchaseProduct(null); load() }}
        />
      )}

      <BottomNav />
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { X, Trash2, Check } from 'lucide-react'
import type { ReceiptTempItem } from '@/types'

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
  const [filter, setFilter] = useState<'all' | '消耗品' | '記帳'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('receipt_temp_items')
      .select('*')
      .eq('profile_id', profileId)
      .eq('is_processed', false)
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false })
    setItems((data as ReceiptTempItem[]) || [])
    setLoading(false)
  }, [profileId])

  useEffect(() => { load() }, [load])

  async function markProcessed(id: string) {
    await supabase.from('receipt_temp_items').update({ is_processed: true }).eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function deleteItem(id: string) {
    await supabase.from('receipt_temp_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    setDeleteConfirm(null)
  }

  const displayed = filter === 'all' ? items : items.filter(i => i.category === filter)

  // Group by date + store
  const groups: { key: string; date: string; store: string; items: ReceiptTempItem[] }[] = []
  for (const item of displayed) {
    const key = `${item.purchase_date}|${item.store ?? ''}`
    const existing = groups.find(g => g.key === key)
    if (existing) {
      existing.items.push(item)
    } else {
      groups.push({ key, date: item.purchase_date, store: item.store ?? '未知通路', items: [item] })
    }
  }

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const accountTotal = items.filter(i => i.category === '記帳').reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full max-w-lg mx-auto rounded-t-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">待處理明細</h3>
            {!loading && items.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">共 {items.length} 筆・合計 ${total.toFixed(0)}</p>
            )}
          </div>
          <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
        </div>

        {/* Filter tabs */}
        <div className="px-5 pb-3 flex gap-2 shrink-0">
          {(['all', '消耗品', '記帳'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                filter === f ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500'
              }`}
            >
              {f === 'all' ? '全部' : f}
            </button>
          ))}
          {filter === '記帳' && accountTotal > 0 && (
            <span className="ml-auto text-xs text-gray-400 self-center">合計 ${accountTotal.toFixed(0)}</span>
          )}
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">載入中…</div>
          ) : groups.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {items.length === 0 ? '沒有待處理明細' : '此分類無項目'}
            </div>
          ) : groups.map(group => (
            <div key={group.key}>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-gray-500">
                  {format(parseISO(group.date), 'M/d')} · {group.store}
                </p>
                <span className="text-xs text-gray-300">
                  ${group.items.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(0)}
                </span>
              </div>
              <div className="space-y-1.5">
                {group.items.map(item => (
                  <div key={item.id} className="bg-gray-50 rounded-xl border flex items-center gap-2 px-3 py-2.5">
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                      item.category === '消耗品' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                    }`}>
                      {item.category}
                    </span>
                    <span className="flex-1 text-sm text-gray-800 truncate">{item.name}</span>
                    <span className="text-xs text-gray-500 shrink-0">
                      ${item.price}
                      {item.quantity > 1 && <span className="text-gray-400"> ×{item.quantity}</span>}
                    </span>
                    {deleteConfirm === item.id ? (
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => deleteItem(item.id)} className="text-xs text-red-500 px-1.5 py-0.5 rounded border border-red-200">刪</button>
                        <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-400 px-1.5 py-0.5 rounded border border-gray-200">取消</button>
                      </div>
                    ) : (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => markProcessed(item.id)}
                          title="標記已處理"
                          className="text-gray-300 hover:text-green-500 p-0.5 transition-colors"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(item.id)}
                          className="text-gray-300 hover:text-red-400 p-0.5 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

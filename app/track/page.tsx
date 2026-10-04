'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { BottomNav } from '@/components/layout/BottomNav'
import { PersonSwitcher } from '@/components/diary/PersonSwitcher'
import { Plus, ChevronRight, Package, Pencil, X } from 'lucide-react'
import Link from 'next/link'
import type { ConsumableItem, ConsumableCategory } from '@/types'

const CATEGORIES: ConsumableCategory[] = ['食品飲料', '保養藥品', '個人護理', '餐廚清潔', '其他']
const UNITS = ['ml', 'g', '顆', '片', '個', '包', '瓶']

function ItemDialog({
  profileId,
  initial,
  onClose,
  onSaved,
}: {
  profileId: string
  initial?: ConsumableItem
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState<ConsumableCategory>(initial?.category ?? '個人護理')
  const [unit, setUnit] = useState(initial?.unit ?? 'ml')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    if (initial) {
      await supabase.from('consumable_items').update({ name: name.trim(), category, unit }).eq('id', initial.id)
    } else {
      await supabase.from('consumable_items').insert({ profile_id: profileId, name: name.trim(), category, unit })
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full max-w-lg mx-auto rounded-t-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">{initial ? '編輯品項' : '新增品項'}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">品項名稱</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例：防曬乳、洗碗粉"
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">類別</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${category === c ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-500'}`}
              >{c}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">單位（每單位單價計算用）</label>
          <div className="flex flex-wrap gap-2">
            {UNITS.map(u => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${unit === u ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-500'}`}
              >{u}</button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm text-gray-500">取消</button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-medium disabled:opacity-50"
          >{saving ? '儲存中…' : initial ? '儲存' : '新增'}</button>
        </div>
      </div>
    </div>
  )
}

export default function TrackPage() {
  const supabase = createClient()
  const { profiles, activeSlot, setActiveSlot } = useAppStore()
  const [profilesState, setProfilesState] = useState<'loading' | 'ready' | 'no-auth'>('loading')
  const [items, setItems] = useState<ConsumableItem[]>([])
  const [productCounts, setProductCounts] = useState<Record<string, number>>({})
  const [activeCategory, setActiveCategory] = useState<ConsumableCategory | 'all'>('all')
  const [showAddItem, setShowAddItem] = useState(false)
  const [editingItem, setEditingItem] = useState<ConsumableItem | null>(null)

  const profile = profiles.find(p => p.slot === activeSlot) ?? profiles[0] ?? null

  useEffect(() => {
    async function loadProfiles() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setProfilesState('no-auth'); return }
        const { data } = await supabase.from('profiles').select('*').order('slot')
        if (data && data.length > 0) setProfilesState('ready')
        else setProfilesState('no-auth')
      } catch { setProfilesState('no-auth') }
    }
    if (profiles.length > 0) setProfilesState('ready')
    else loadProfiles()
  }, [])

  const load = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('consumable_items')
      .select('*')
      .eq('profile_id', profile.id)
      .order('category')
      .order('name')
    setItems((data as ConsumableItem[]) || [])

    if (data && data.length > 0) {
      const { data: prods } = await supabase
        .from('consumable_products')
        .select('id, item_id')
        .in('item_id', (data as ConsumableItem[]).map(i => i.id))
      const counts: Record<string, number> = {}
      for (const p of prods || []) counts[p.item_id] = (counts[p.item_id] || 0) + 1
      setProductCounts(counts)
    }
  }, [profile?.id])

  useEffect(() => { if (profile) load() }, [load])

  if (profilesState === 'loading') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-sm text-gray-400">載入中…</p>
    </div>
  )
  if (profilesState === 'no-auth' || !profile) return (
    <div className="min-h-screen bg-gray-50 pb-20 flex items-center justify-center">
      <a href="/login" className="py-2 px-6 bg-green-500 text-white rounded-full text-sm font-medium">請先登入</a>
    </div>
  )

  const displayed = activeCategory === 'all' ? items : items.filter(i => i.category === activeCategory)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 pt-3 pb-2">
          {profiles.length > 0 && (
            <PersonSwitcher profiles={profiles} activeSlot={activeSlot} onSwitch={setActiveSlot} />
          )}
          <div className="flex items-center justify-between mt-2">
            <h1 className="text-base font-semibold text-gray-800">消耗品管理</h1>
            <button
              onClick={() => setShowAddItem(true)}
              className="flex items-center gap-1 text-xs text-green-600 font-medium"
            >
              <Plus className="h-4 w-4" />新增品項
            </button>
          </div>
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {(['all', ...CATEGORIES] as const).map(c => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs border transition-colors ${activeCategory === c ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-500'}`}
              >{c === 'all' ? '全部' : c}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-2">
        {displayed.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{activeCategory === 'all' ? '尚無品項，點右上角新增' : `此類別尚無品項`}</p>
          </div>
        ) : displayed.map(item => (
          <div key={item.id} className="bg-white rounded-2xl border flex items-center">
            <Link href={`/track/${item.id}`} className="flex-1 flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                <p className="text-xs text-gray-400">
                  {item.category}・{productCounts[item.id] ?? 0} 個商品・{item.unit}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
            </Link>
            <button
              onClick={() => setEditingItem(item)}
              className="p-4 pl-0 text-gray-300 hover:text-gray-500"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {showAddItem && (
        <ItemDialog
          profileId={profile.id}
          onClose={() => setShowAddItem(false)}
          onSaved={() => { setShowAddItem(false); load() }}
        />
      )}
      {editingItem && (
        <ItemDialog
          profileId={profile.id}
          initial={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => { setEditingItem(null); load() }}
        />
      )}

      <BottomNav />
    </div>
  )
}

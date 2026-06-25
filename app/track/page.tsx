'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { BottomNav } from '@/components/layout/BottomNav'
import { PersonSwitcher } from '@/components/diary/PersonSwitcher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { format, parseISO, subDays, addDays, differenceInCalendarDays } from 'date-fns'
import { Plus, Check, X, Search, ChevronDown, ChevronUp, Pin, Pencil } from 'lucide-react'
import type { Habit, HabitLog, TrackerItem, TrackerLog, Profile } from '@/types'

const TABS = ['習慣', '頻率事項'] as const
type Tab = typeof TABS[number]

const PRESET_CATEGORIES = ['家事', '耗材', '保養', '旅遊', '健康', '其他']

function toLocalDateTimeStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function nowLocalStr(): string {
  return toLocalDateTimeStr(new Date())
}

function computeHistoryStats(logs: TrackerLog[]) {
  if (logs.length < 2) return null
  const sorted = [...logs].sort((a, b) => a.completed_at.localeCompare(b.completed_at))
  const intervals: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const diff = differenceInCalendarDays(parseISO(sorted[i].completed_at), parseISO(sorted[i - 1].completed_at))
    if (diff > 0) intervals.push(diff)
  }
  if (intervals.length === 0) return null
  const avgDays = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
  const latest = sorted[sorted.length - 1]
  const nextDue = addDays(parseISO(latest.completed_at), avgDays)
  return { avgDays, nextDue }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrackPage() {
  const supabase = createClient()
  const { activeSlot, setActiveSlot, profiles, setProfiles, activeProfile } = useAppStore()
  const profile = activeProfile()

  const [pageState, setPageState] = useState<'loading' | 'ready' | 'no-auth'>('loading')
  const [tab, setTab] = useState<Tab>('習慣')

  useEffect(() => {
    async function loadProfiles() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setPageState('no-auth'); return }
        const { data } = await supabase.from('profiles').select('*').order('slot')
        if (data && data.length > 0) {
          setProfiles(data as Profile[])
          setPageState('ready')
        } else { setPageState('no-auth') }
      } catch { setPageState('no-auth') }
    }
    if (profiles.length > 0) setPageState('ready')
    else loadProfiles()
  }, [])

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 py-3">
            <div className="h-9 bg-gray-100 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    )
  }
  if (pageState === 'no-auth' || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 flex items-center justify-center">
        <a href="/login" className="py-2 px-6 bg-green-500 text-white rounded-full text-sm font-medium">請先登入</a>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          {profiles.length > 0 && (
            <PersonSwitcher profiles={profiles} activeSlot={activeSlot} onSwitch={setActiveSlot} />
          )}
          <div className="flex gap-0 mt-3 border-b border-gray-100">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
                  tab === t ? 'border-green-500 text-green-600' : 'border-transparent text-gray-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {tab === '習慣' && <HabitTab profile={profile} />}
        {tab === '頻率事項' && <TrackerTab profile={profile} />}
      </div>

      <BottomNav />
    </div>
  )
}

// ─── Habit Tab ────────────────────────────────────────────────────────────────

function HabitTab({ profile }: { profile: Profile }) {
  const supabase = createClient()
  const todayDate = new Date()
  const today = format(todayDate, 'yyyy-MM-dd')
  const GRID_DAYS = 35
  const dow = (todayDate.getDay() + 6) % 7
  const thisMonday = subDays(todayDate, dow)
  const gridStart = subDays(thisMonday, 28)

  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [toggling, setToggling] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const loadHabits = useCallback(async () => {
    const { data } = await supabase
      .from('habits')
      .select('*')
      .eq('profile_id', profile.id)
      .eq('is_active', true)
      .order('sort_order')
      .order('created_at')
    setHabits((data as Habit[]) || [])
  }, [profile.id])

  const loadLogs = useCallback(async () => {
    const since = format(gridStart, 'yyyy-MM-dd')
    const { data } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('profile_id', profile.id)
      .gte('logged_date', since)
    setLogs((data as HabitLog[]) || [])
  }, [profile.id])

  useEffect(() => { loadHabits(); loadLogs() }, [loadHabits, loadLogs])

  const logSet = new Set(logs.map(l => `${l.habit_id}:${l.logged_date}`))
  const todayDone = (habitId: string) => logSet.has(`${habitId}:${today}`)

  async function toggleToday(habit: Habit) {
    setToggling(s => new Set(s).add(habit.id))
    const done = todayDone(habit.id)
    if (done) {
      const log = logs.find(l => l.habit_id === habit.id && l.logged_date === today)
      if (log) {
        await supabase.from('habit_logs').delete().eq('id', log.id)
        setLogs(ls => ls.filter(l => l.id !== log.id))
      }
    } else {
      const { data } = await supabase.from('habit_logs').insert({
        habit_id: habit.id,
        profile_id: profile.id,
        logged_date: today,
      }).select().single()
      if (data) setLogs(ls => [...ls, data as HabitLog])
    }
    setToggling(s => { const ns = new Set(s); ns.delete(habit.id); return ns })
  }

  async function addHabit() {
    if (!newName.trim()) return
    setAdding(true)
    const { data } = await supabase.from('habits').insert({
      profile_id: profile.id,
      name: newName.trim(),
      sort_order: habits.length,
    }).select().single()
    if (data) setHabits(h => [...h, data as Habit])
    setNewName(''); setShowAdd(false); setAdding(false)
  }

  async function deleteHabit(id: string) {
    await supabase.from('habits').update({ is_active: false }).eq('id', id)
    setHabits(h => h.filter(x => x.id !== id))
    setDeleteConfirm(null)
  }

  const gridDays = Array.from({ length: GRID_DAYS }, (_, i) =>
    format(addDays(gridStart, i), 'yyyy-MM-dd')
  )

  const DOW = ['一', '二', '三', '四', '五', '六', '日']

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">
          今天 {format(new Date(), 'M/d')}
          <span className="ml-2 text-xs text-gray-400">
            {habits.filter(h => todayDone(h.id)).length}/{habits.length} 完成
          </span>
        </p>
        {habits.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">還沒有習慣，點下方新增</p>
        ) : (
          <div className="space-y-2">
            {habits.map(h => {
              const done = todayDone(h.id)
              const busy = toggling.has(h.id)
              return (
                <div key={h.id} className="flex items-center gap-3">
                  <button
                    onClick={() => !busy && toggleToday(h)}
                    disabled={busy}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      done ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-white'
                    }`}
                  >
                    {done && <Check className="h-4 w-4 text-white" />}
                  </button>
                  <span className={`flex-1 text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {h.name}
                  </span>
                  {deleteConfirm === h.id ? (
                    <div className="flex gap-1.5">
                      <button onClick={() => deleteHabit(h.id)} className="text-xs text-red-500 px-2 py-0.5 rounded border border-red-200">刪除</button>
                      <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-400 px-2 py-0.5 rounded border border-gray-200">取消</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(h.id)} className="text-gray-300 hover:text-gray-400 p-1">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {showAdd ? (
          <div className="mt-3 flex gap-2">
            <Input
              autoFocus
              placeholder="習慣名稱"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addHabit()}
              className="flex-1 h-8 text-sm"
            />
            <Button onClick={addHabit} disabled={adding || !newName.trim()} className="h-8 px-3 bg-green-500 hover:bg-green-600 text-xs">新增</Button>
            <Button variant="outline" onClick={() => { setShowAdd(false); setNewName('') }} className="h-8 px-3 text-xs">取消</Button>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="mt-3 flex items-center gap-1 text-xs text-gray-400 hover:text-green-600 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />新增習慣
          </button>
        )}
      </div>

      {habits.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">近 {GRID_DAYS} 天統計</p>
          {habits.map(h => {
            const pastDays = gridDays.filter(d => d <= today)
            const doneDays = pastDays.filter(d => logSet.has(`${h.id}:${d}`))
            const rate = pastDays.length ? Math.round((doneDays.length / pastDays.length) * 100) : 0
            let streak = 0
            for (let i = 0; i < GRID_DAYS; i++) {
              const d = format(subDays(todayDate, i), 'yyyy-MM-dd')
              if (logSet.has(`${h.id}:${d}`)) streak++
              else break
            }
            return (
              <div key={h.id} className="bg-white rounded-2xl border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-800">{h.name}</span>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span><span className="font-semibold text-green-600">{rate}%</span></span>
                    <span>連續 <span className="font-semibold text-gray-700">{streak}</span> 天</span>
                  </div>
                </div>
                <div>
                  <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                    {DOW.map(d => (
                      <div key={d} className="text-center text-xs text-gray-300">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {gridDays.map(d => (
                      <div
                        key={d}
                        title={d}
                        className={`h-5 rounded-sm ${
                          d > today ? 'bg-transparent' :
                          logSet.has(`${h.id}:${d}`) ? 'bg-green-500' :
                          d === today ? 'bg-gray-200 ring-1 ring-gray-400' :
                          'bg-gray-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Tracker Tab ──────────────────────────────────────────────────────────────

interface TrackerItemWithLast extends TrackerItem {
  lastCompletedAt: string | null
  daysSince: number | null
}

function TrackerTab({ profile }: { profile: Profile }) {
  const supabase = createClient()

  const [items, setItems] = useState<TrackerItemWithLast[]>([])
  const [category, setCategory] = useState('全部')
  const [query, setQuery] = useState('')
  const [completing, setCompleting] = useState<Set<string>>(new Set())
  const [justDone, setJustDone] = useState<Set<string>>(new Set())
  const [confirmingItem, setConfirmingItem] = useState<string | null>(null)
  const [confirmNote, setConfirmNote] = useState('')
  const [confirmAt, setConfirmAt] = useState(nowLocalStr())
  const [historyItem, setHistoryItem] = useState<string | null>(null)
  const [itemHistory, setItemHistory] = useState<Record<string, TrackerLog[]>>({})
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null)
  const [editingLog, setEditingLog] = useState<string | null>(null)
  const [editingLogAt, setEditingLogAt] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', category: '其他', interval_days: '', note: '' })
  const [adding, setAdding] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const [{ data: itemData }, { data: logData }] = await Promise.all([
      supabase.from('tracker_items').select('*').eq('profile_id', profile.id).eq('is_active', true).order('sort_order').order('created_at'),
      supabase.from('tracker_logs').select('item_id, completed_at').eq('profile_id', profile.id).order('completed_at', { ascending: false }),
    ])
    const latestLog: Record<string, string> = {}
    for (const log of (logData as TrackerLog[]) || []) {
      if (!latestLog[log.item_id]) latestLog[log.item_id] = log.completed_at
    }
    const now = new Date()
    const merged: TrackerItemWithLast[] = ((itemData as TrackerItem[]) || []).map(item => {
      const last = latestLog[item.id] ?? null
      const daysSince = last ? differenceInCalendarDays(now, parseISO(last)) : null
      return { ...item, lastCompletedAt: last, daysSince }
    })
    setItems(merged)
  }, [profile.id])

  useEffect(() => { loadData() }, [loadData])

  async function completeItem(id: string, note: string, completedAt: string) {
    setCompleting(s => new Set(s).add(id))
    setConfirmingItem(null)
    setConfirmNote('')
    const { data } = await supabase.from('tracker_logs').insert({
      item_id: id,
      profile_id: profile.id,
      completed_at: new Date(completedAt).toISOString(),
      note: note.trim() || null,
    }).select().single()
    if (data) {
      setItems(prev => prev.map(item =>
        item.id === id ? { ...item, lastCompletedAt: (data as TrackerLog).completed_at, daysSince: 0 } : item
      ))
      setItemHistory(prev => prev[id] ? { ...prev, [id]: [data as TrackerLog, ...prev[id]] } : prev)
      setJustDone(s => new Set(s).add(id))
      setTimeout(() => setJustDone(s => { const ns = new Set(s); ns.delete(id); return ns }), 3000)
    }
    setCompleting(s => { const ns = new Set(s); ns.delete(id); return ns })
  }

  async function saveLogEdit(logId: string, itemId: string) {
    const isoAt = new Date(editingLogAt).toISOString()
    await supabase.from('tracker_logs').update({ completed_at: isoAt }).eq('id', logId)
    setEditingLog(null)
    const { data } = await supabase
      .from('tracker_logs')
      .select('*')
      .eq('item_id', itemId)
      .order('completed_at', { ascending: false })
      .limit(30)
    setItemHistory(prev => ({ ...prev, [itemId]: (data as TrackerLog[]) || [] }))
    loadData()
  }

  async function toggleHistory(id: string) {
    if (historyItem === id) { setHistoryItem(null); return }
    setHistoryItem(id)
    if (itemHistory[id]) return
    setLoadingHistory(id)
    const { data } = await supabase
      .from('tracker_logs')
      .select('*')
      .eq('item_id', id)
      .order('completed_at', { ascending: false })
      .limit(30)
    setItemHistory(prev => ({ ...prev, [id]: (data as TrackerLog[]) || [] }))
    setLoadingHistory(null)
  }

  async function deleteItem(id: string) {
    await supabase.from('tracker_items').update({ is_active: false }).eq('id', id)
    setItems(prev => prev.filter(x => x.id !== id))
    setDeleteConfirm(null)
  }

  async function addItem() {
    if (!newItem.name.trim()) return
    setAdding(true)
    const { data } = await supabase.from('tracker_items').insert({
      profile_id: profile.id,
      name: newItem.name.trim(),
      category: newItem.category || '其他',
      interval_days: newItem.interval_days ? parseInt(newItem.interval_days) : null,
      note: newItem.note.trim() || null,
      sort_order: items.length,
    }).select().single()
    if (data) {
      setItems(prev => [...prev, { ...(data as TrackerItem), lastCompletedAt: null, daysSince: null }])
    }
    setNewItem({ name: '', category: '其他', interval_days: '', note: '' })
    setShowAdd(false); setAdding(false)
  }

  async function togglePin(id: string, current: boolean) {
    await supabase.from('tracker_items').update({ is_pinned: !current }).eq('id', id)
    setItems(prev => prev.map(item => item.id === id ? { ...item, is_pinned: !current } : item))
  }

  const sortedItems = [...items].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    const aOverdue = a.interval_days != null && a.daysSince != null && a.daysSince > a.interval_days
    const bOverdue = b.interval_days != null && b.daysSince != null && b.daysSince > b.interval_days
    if (aOverdue && !bOverdue) return -1
    if (!aOverdue && bOverdue) return 1
    const aDays = a.daysSince ?? 9999
    const bDays = b.daysSince ?? 9999
    return bDays - aDays
  })

  // category filter includes presets in use + any custom categories in use
  const usedCategories = [...new Set(items.map(i => i.category))]
  const orderedCategories = [
    ...PRESET_CATEGORIES.filter(c => usedCategories.includes(c)),
    ...usedCategories.filter(c => !PRESET_CATEGORIES.includes(c)),
  ]
  const categories = ['全部', ...orderedCategories]

  // custom categories already used (shown as extra chips in the add form)
  const customCategoriesInUse = usedCategories.filter(c => !PRESET_CATEGORIES.includes(c))

  const filtered = sortedItems.filter(item => {
    const catMatch = category === '全部' || item.category === category
    const queryMatch = !query || item.name.includes(query)
    return catMatch && queryMatch
  })

  function urgencyLabel(item: TrackerItemWithLast) {
    if (item.daysSince === null) return { text: '從未記錄', color: 'text-gray-400' }
    if (item.daysSince === 0) return { text: '今天', color: 'text-green-600' }
    if (item.interval_days != null) {
      const overdue = item.daysSince - item.interval_days
      if (overdue > 0) return { text: `逾期 ${overdue} 天`, color: 'text-red-500' }
      const remaining = item.interval_days - item.daysSince
      if (remaining <= 7) return { text: `${remaining} 天後到期`, color: 'text-orange-500' }
    }
    return { text: `${item.daysSince} 天前`, color: 'text-gray-500' }
  }

  // whether the typed category in the add form is a custom (non-preset) value
  const isCustomCategory = !PRESET_CATEGORIES.includes(newItem.category) && !customCategoriesInUse.includes(newItem.category)

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="搜尋事項..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs border font-medium transition-colors ${
              category === c ? 'border-green-500 text-green-600 bg-green-50' : 'border-gray-200 text-gray-500 bg-white'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Add item — placed at top */}
      {showAdd ? (
        <div className="bg-white rounded-2xl border p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">新增事項</p>
          <Input
            autoFocus
            placeholder="事項名稱"
            value={newItem.name}
            onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
          />
          <div className="space-y-2">
            <p className="text-xs text-gray-500">分類</p>
            <div className="flex flex-wrap gap-2">
              {[...PRESET_CATEGORIES, ...customCategoriesInUse].map(c => (
                <button
                  key={c}
                  onClick={() => setNewItem(p => ({ ...p, category: c }))}
                  className={`px-3 py-1.5 rounded-full text-xs border font-medium transition-colors ${
                    newItem.category === c ? 'border-green-500 text-green-600 bg-green-50' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <Input
              placeholder="或輸入自訂分類..."
              value={isCustomCategory ? newItem.category : ''}
              onChange={e => {
                const val = e.target.value
                setNewItem(p => ({ ...p, category: val || '其他' }))
              }}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500">提醒週期（天，選填）</p>
            <Input
              type="number" min="1"
              placeholder="例：90（每90天）"
              value={newItem.interval_days}
              onChange={e => setNewItem(p => ({ ...p, interval_days: e.target.value }))}
            />
            <p className="text-xs text-gray-400">留空則只記錄頻率，不提醒到期</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500">備註（選填）</p>
            <textarea
              placeholder="注意事項、提醒自己的細節..."
              value={newItem.note}
              onChange={e => setNewItem(p => ({ ...p, note: e.target.value }))}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={addItem} disabled={adding || !newItem.name.trim()} className="flex-1 bg-green-500 hover:bg-green-600 h-9 text-sm">
              {adding ? '新增中...' : '新增'}
            </Button>
            <Button variant="outline" onClick={() => setShowAdd(false)} className="flex-1 h-9 text-sm">取消</Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl border border-dashed border-gray-300 text-sm text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors bg-white"
        >
          <Plus className="h-4 w-4" />新增事項
        </button>
      )}

      {/* Items list */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-gray-400">
          {items.length === 0 ? '新增第一個事項吧' : '沒有符合的事項'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const { text: urgText, color: urgColor } = urgencyLabel(item)
            const busy = completing.has(item.id)
            const done = justDone.has(item.id)
            const isConfirming = confirmingItem === item.id
            const isShowingHistory = historyItem === item.id
            return (
              <div key={item.id} className="bg-white rounded-2xl border p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{item.name}</span>
                      <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{item.category}</span>
                      {item.interval_days && (
                        <span className="text-xs text-gray-400">每 {item.interval_days} 天</span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 ${urgColor}`}>{urgText}</p>
                    {item.note && <p className="text-xs text-gray-400 mt-1">{item.note}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {deleteConfirm === item.id ? (
                      <div className="flex gap-1.5">
                        <button onClick={() => deleteItem(item.id)} className="text-xs text-red-500 px-2 py-0.5 rounded border border-red-200">刪除</button>
                        <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-400 px-2 py-0.5 rounded border border-gray-200">取消</button>
                      </div>
                    ) : done ? (
                      <span className="text-xs text-green-600 font-medium bg-green-50 rounded-full px-2.5 py-1">✓ 完成</span>
                    ) : isConfirming ? null : (
                      <>
                        <button
                          onClick={() => togglePin(item.id, item.is_pinned)}
                          className={`p-1 rounded transition-colors ${item.is_pinned ? 'text-orange-400' : 'text-gray-300 hover:text-orange-300'}`}
                          title={item.is_pinned ? '取消置頂' : '置頂常用'}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => { setConfirmingItem(item.id); setConfirmNote(''); setConfirmAt(nowLocalStr()) }}
                          disabled={busy}
                          className="text-xs font-medium text-white bg-green-500 hover:bg-green-600 rounded-full px-3 py-1.5 transition-colors disabled:opacity-50"
                        >
                          {busy ? '...' : '完成'}
                        </button>
                        <button onClick={() => setDeleteConfirm(item.id)} className="text-gray-300 hover:text-gray-400 p-0.5">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Inline confirm with time + note */}
                {isConfirming && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400">完成時間</p>
                      <input
                        type="datetime-local"
                        value={confirmAt}
                        onChange={e => setConfirmAt(e.target.value)}
                        className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                      />
                    </div>
                    <Input
                      autoFocus
                      placeholder="備註（選填），按 Enter 確認"
                      value={confirmNote}
                      onChange={e => setConfirmNote(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && completeItem(item.id, confirmNote, confirmAt)}
                      className="text-sm h-8"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => completeItem(item.id, confirmNote, confirmAt)}
                        className="flex-1 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium"
                      >
                        確認完成
                      </button>
                      <button
                        onClick={() => { setConfirmingItem(null); setConfirmNote('') }}
                        className="flex-1 py-1.5 rounded-lg border text-xs text-gray-500"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}

                {/* History toggle */}
                {!isConfirming && (
                  <button
                    onClick={() => toggleHistory(item.id)}
                    className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {isShowingHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    歷史記錄
                  </button>
                )}

                {/* History list */}
                {isShowingHistory && (
                  <div className="mt-2 pt-2 border-t">
                    {loadingHistory === item.id ? (
                      <p className="text-xs text-gray-400 py-2">載入中...</p>
                    ) : (itemHistory[item.id] || []).length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">尚無完成記錄</p>
                    ) : (
                      <>
                        {(() => {
                          const stats = computeHistoryStats(itemHistory[item.id] || [])
                          if (!stats) return null
                          return (
                            <div className="mb-2 px-3 py-2 bg-blue-50 rounded-lg flex gap-4 text-xs">
                              <span className="text-gray-500">平均 <span className="font-semibold text-gray-700">{stats.avgDays}</span> 天一次</span>
                              <span className="text-gray-500">預估下次 <span className="font-semibold text-blue-600">{format(stats.nextDue, 'yyyy/M/d')}</span></span>
                            </div>
                          )
                        })()}
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {(itemHistory[item.id] || []).map(log => (
                          <div key={log.id} className="text-xs">
                            {editingLog === log.id ? (
                              <div className="space-y-1.5 py-1">
                                <input
                                  type="datetime-local"
                                  value={editingLogAt}
                                  onChange={e => setEditingLogAt(e.target.value)}
                                  className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                                />
                                <div className="flex gap-1.5">
                                  <button onClick={() => saveLogEdit(log.id, item.id)} className="text-xs text-green-600 px-2 py-0.5 rounded border border-green-200">儲存</button>
                                  <button onClick={() => setEditingLog(null)} className="text-xs text-gray-400 px-2 py-0.5 rounded border border-gray-200">取消</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <span className="text-gray-400 shrink-0 w-28">
                                  {format(parseISO(log.completed_at), 'yyyy/M/d HH:mm')}
                                </span>
                                {log.note && <span className="text-gray-600 flex-1">{log.note}</span>}
                                <button
                                  onClick={() => {
                                    setEditingLog(log.id)
                                    setEditingLogAt(toLocalDateTimeStr(parseISO(log.completed_at)))
                                  }}
                                  className="text-gray-300 hover:text-gray-500 p-0.5 shrink-0 ml-auto"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}

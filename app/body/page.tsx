'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { BottomNav } from '@/components/layout/BottomNav'
import { PersonSwitcher } from '@/components/diary/PersonSwitcher'
import { BodyMetricDialog } from '@/components/body/BodyMetricDialog'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { format, parseISO, startOfWeek, endOfWeek, subWeeks, addDays } from 'date-fns'
import type { BodyMetric, Profile } from '@/types'

const TABS = ['趨勢', '飲食連動', '歷史記錄'] as const
type Tab = (typeof TABS)[number]

const METRICS = [
  { key: 'weight_kg' as const, label: '體重', unit: 'kg', color: '#6366f1' },
  { key: 'body_fat_pct' as const, label: '體脂', unit: '%', color: '#ef4444' },
  { key: 'muscle_kg' as const, label: '肌肉量', unit: 'kg', color: '#3b82f6' },
  { key: 'visceral_fat' as const, label: '內臟脂肪', unit: '', color: '#f97316' },
]
type MetricKey = (typeof METRICS)[number]['key']

const RANGES = [
  { label: '1個月', weeks: 4 },
  { label: '3個月', weeks: 13 },
  { label: '6個月', weeks: 26 },
]

function formatValue(v: number | null, key: MetricKey) {
  if (v == null) return '—'
  if (key === 'weight_kg' || key === 'muscle_kg') return v.toFixed(1)
  if (key === 'body_fat_pct') return v.toFixed(1)
  return v.toString()
}

export default function BodyPage() {
  const supabase = createClient()
  const { activeSlot, setActiveSlot, profiles, setProfiles, activeProfile } = useAppStore()
  const profile = activeProfile()

  const [profilesState, setProfilesState] = useState<'loading' | 'ready' | 'no-auth'>('loading')
  const [tab, setTab] = useState<Tab>('趨勢')
  const [metrics, setMetrics] = useState<BodyMetric[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [editingMetric, setEditingMetric] = useState<BodyMetric | null>(null)
  const [activeMetric, setActiveMetric] = useState<MetricKey>('weight_kg')
  const [rangeWeeks, setRangeWeeks] = useState(13)
  const [weeklyStats, setWeeklyStats] = useState<Array<{week: string, avg: Record<MetricKey, number | null>}>>([])
  const [mealCorrelation, setMealCorrelation] = useState<Array<{date: string, calories: number, protein: number, weight: number | null}>>([])

  useEffect(() => {
    async function loadProfiles() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setProfilesState('no-auth'); return }
        const { data } = await supabase.from('profiles').select('*').order('slot')
        if (data && data.length > 0) {
          setProfiles(data as Profile[])
          setProfilesState('ready')
        } else {
          setProfilesState('no-auth')
        }
      } catch {
        setProfilesState('no-auth')
      }
    }
    if (profiles.length > 0) {
      setProfilesState('ready')
    } else {
      loadProfiles()
    }
  }, [])

  const loadMetrics = useCallback(async () => {
    if (!profile) return
    const since = format(subWeeks(new Date(), rangeWeeks), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('body_metrics')
      .select('*')
      .eq('profile_id', profile.id)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true })
    setMetrics((data as BodyMetric[]) || [])
  }, [profile?.id, rangeWeeks])

  const loadMealCorrelation = useCallback(async () => {
    if (!profile) return
    const since = format(subWeeks(new Date(), rangeWeeks), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('meal_entries')
      .select('log_date, calories, protein')
      .eq('profile_id', profile.id)
      .gte('log_date', since)
    const byDate: Record<string, { calories: number; protein: number }> = {}
    for (const row of data || []) {
      const d = row.log_date as string
      if (!byDate[d]) byDate[d] = { calories: 0, protein: 0 }
      byDate[d].calories += Number(row.calories) || 0
      byDate[d].protein += Number(row.protein) || 0
    }
    // first-of-day weights keyed by date
    const firstWeights: Record<string, number> = {}
    for (const m of metrics) {
      if (!m.is_first_of_day || m.weight_kg == null) continue
      const d = format(parseISO(m.recorded_at), 'yyyy-MM-dd')
      if (!firstWeights[d]) firstWeights[d] = m.weight_kg
    }
    const allDates = [...new Set([...Object.keys(byDate), ...Object.keys(firstWeights)])].sort()
    setMealCorrelation(
      allDates.map(d => ({
        date: d,
        calories: byDate[d]?.calories ?? 0,
        protein: byDate[d]?.protein ?? 0,
        weight: firstWeights[d] ?? null,
      }))
    )
  }, [profile?.id, rangeWeeks, metrics])

  useEffect(() => {
    if (profile) loadMetrics()
  }, [loadMetrics])

  useEffect(() => {
    if (tab === '飲食連動') loadMealCorrelation()
  }, [tab, loadMealCorrelation])

  // weekly averages for trend chart
  useEffect(() => {
    if (!metrics.length) { setWeeklyStats([]); return }
    const weeks: Array<{week: string, avg: Record<MetricKey, number | null>}> = []
    const first = parseISO(metrics[0].recorded_at)
    const last = parseISO(metrics[metrics.length - 1].recorded_at)
    let cursor = startOfWeek(first, { weekStartsOn: 1 })
    while (cursor <= last) {
      const end = endOfWeek(cursor, { weekStartsOn: 1 })
      const inWeek = metrics.filter(m => {
        const d = parseISO(m.recorded_at)
        return d >= cursor && d <= end && m.is_first_of_day
      })
      const avg = (key: MetricKey) => {
        const vals = inWeek.map(m => m[key]).filter((v): v is number => v != null)
        return vals.length ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null
      }
      weeks.push({
        week: format(cursor, 'M/d'),
        avg: {
          weight_kg: avg('weight_kg'),
          body_fat_pct: avg('body_fat_pct'),
          muscle_kg: avg('muscle_kg'),
          visceral_fat: avg('visceral_fat'),
        },
      })
      cursor = addDays(end, 1)
    }
    setWeeklyStats(weeks)
  }, [metrics])

  if (profilesState === 'loading') {
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

  if (profilesState === 'no-auth' || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 flex items-center justify-center">
        <a href="/login" className="py-2 px-6 bg-green-500 text-white rounded-full text-sm font-medium">
          請先登入
        </a>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Sticky header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {profiles.length > 0 && (
              <PersonSwitcher profiles={profiles} activeSlot={activeSlot} onSwitch={setActiveSlot} />
            )}
            <button
              onClick={() => { setEditingMetric(null); setShowDialog(true) }}
              className="flex items-center gap-1 text-sm font-medium text-white bg-green-500 rounded-full px-3 py-1.5 hover:bg-green-600"
            >
              <Plus className="h-4 w-4" />記錄
            </button>
          </div>
          {/* Tab bar */}
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

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {tab === '趨勢' && (
          <TrendTab
            profile={profile}
            metrics={metrics}
            weeklyStats={weeklyStats}
            activeMetric={activeMetric}
            setActiveMetric={setActiveMetric}
            rangeWeeks={rangeWeeks}
            setRangeWeeks={(w) => setRangeWeeks(w)}
            onEditTargets={() => {/* handled inline */}}
          />
        )}
        {tab === '飲食連動' && (
          <DietTab profile={profile} data={mealCorrelation} />
        )}
        {tab === '歷史記錄' && (
          <HistoryTab
            metrics={[...metrics].reverse()}
            onEdit={m => { setEditingMetric(m); setShowDialog(true) }}
            onDelete={async (id) => {
              await supabase.from('body_metrics').delete().eq('id', id)
              loadMetrics()
            }}
          />
        )}
      </div>

      {showDialog && (
        <BodyMetricDialog
          profileId={profile.id}
          initial={editingMetric ?? undefined}
          onClose={() => { setShowDialog(false); setEditingMetric(null) }}
          onSaved={() => { setShowDialog(false); setEditingMetric(null); loadMetrics() }}
        />
      )}

      <BottomNav />
    </div>
  )
}

// ─── Trend Tab ───────────────────────────────────────────────────────────────

interface TrendTabProps {
  profile: Profile
  metrics: BodyMetric[]
  weeklyStats: Array<{week: string, avg: Record<MetricKey, number | null>}>
  activeMetric: MetricKey
  setActiveMetric: (k: MetricKey) => void
  rangeWeeks: number
  setRangeWeeks: (w: number) => void
  onEditTargets: () => void
}

function TrendTab({ profile, metrics, weeklyStats, activeMetric, setActiveMetric, rangeWeeks, setRangeWeeks }: TrendTabProps) {
  const supabase = createClient()
  const metaDef = METRICS.find(m => m.key === activeMetric)!

  // latest first-of-day entry for current stats
  const latest = [...metrics].reverse().find(m => m.is_first_of_day)
  const latestAll = metrics.length ? metrics[metrics.length - 1] : null

  // 4-week rate calculation (weight only)
  const fourWeekRate = (() => {
    const firstOfDays = metrics.filter(m => m.is_first_of_day && m.weight_kg != null)
    if (firstOfDays.length < 2) return null
    const recent = firstOfDays[firstOfDays.length - 1]
    const fourWkAgo = new Date(recent.recorded_at)
    fourWkAgo.setDate(fourWkAgo.getDate() - 28)
    const baseline = firstOfDays.find(m => parseISO(m.recorded_at) >= fourWkAgo)
    if (!baseline || baseline.id === recent.id) return null
    const weeks = (parseISO(recent.recorded_at).getTime() - parseISO(baseline.recorded_at).getTime()) / (7 * 86400000)
    return weeks > 0 ? (recent.weight_kg! - baseline.weight_kg!) / weeks : null
  })()

  const targetWeight = profile.target_weight_kg
  const currentWeight = latest?.weight_kg ?? null
  const distToTarget = targetWeight != null && currentWeight != null ? currentWeight - targetWeight : null
  const etaWeeks = fourWeekRate != null && distToTarget != null && fourWeekRate !== 0
    ? Math.abs(distToTarget / fourWeekRate)
    : null

  // SVG line chart
  const chartData = weeklyStats.map(w => ({ label: w.week, value: w.avg[activeMetric] }))
  const chartValues = chartData.map(d => d.value).filter((v): v is number => v != null)
  const minV = chartValues.length ? Math.min(...chartValues) : 0
  const maxV = chartValues.length ? Math.max(...chartValues) : 1
  const range = maxV - minV || 1
  const CHART_W = 320
  const CHART_H = 120
  const PAD = 8
  const points = chartData
    .map((d, i) => {
      if (d.value == null) return null
      const x = PAD + (i / Math.max(chartData.length - 1, 1)) * (CHART_W - PAD * 2)
      const y = PAD + ((maxV - d.value) / range) * (CHART_H - PAD * 2)
      return { x, y, value: d.value, label: d.label }
    })
    .filter((p): p is NonNullable<typeof p> => p != null)

  const pathD = points.length > 1
    ? 'M ' + points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')
    : ''

  const [editingTarget, setEditingTarget] = useState(false)
  const [targetForm, setTargetForm] = useState({
    target_weight_kg: profile.target_weight_kg != null ? String(profile.target_weight_kg) : '',
    weekly_target_rate: profile.weekly_target_rate != null ? String(profile.weekly_target_rate) : '',
  })
  const [targetSaving, setTargetSaving] = useState(false)
  const { setProfiles, profiles } = useAppStore()

  async function saveTargets() {
    setTargetSaving(true)
    const { data } = await supabase
      .from('profiles')
      .update({
        target_weight_kg: targetForm.target_weight_kg ? parseFloat(targetForm.target_weight_kg) : null,
        weekly_target_rate: targetForm.weekly_target_rate ? parseFloat(targetForm.weekly_target_rate) : null,
      })
      .eq('id', profile.id)
      .select()
      .single()
    if (data) setProfiles(profiles.map(p => p.id === data.id ? data as Profile : p))
    setTargetSaving(false)
    setEditingTarget(false)
  }

  return (
    <div className="space-y-4">
      {/* Goal progress card */}
      {targetWeight != null && !editingTarget && (
        <div className="bg-white rounded-2xl border p-4">
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">體重目標</p>
            <button onClick={() => setEditingTarget(true)} className="text-xs text-gray-400 hover:text-gray-600">
              編輯
            </button>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <p className="text-2xl font-bold text-gray-800">{currentWeight?.toFixed(1) ?? '—'} kg</p>
              <p className="text-xs text-gray-400 mt-0.5">目前體重</p>
            </div>
            <div className="flex items-center gap-1.5 mb-1 text-gray-400">
              {distToTarget != null && (
                distToTarget > 0 ? <TrendingDown className="h-4 w-4 text-green-500" /> :
                distToTarget < 0 ? <TrendingUp className="h-4 w-4 text-red-400" /> :
                <Minus className="h-4 w-4 text-gray-400" />
              )}
            </div>
            <div>
              <p className="text-2xl font-bold text-indigo-600">{targetWeight.toFixed(1)} kg</p>
              <p className="text-xs text-gray-400 mt-0.5">目標體重</p>
            </div>
          </div>
          {(distToTarget != null || fourWeekRate != null) && (
            <p className="text-xs text-gray-500 mt-2 border-t pt-2">
              {distToTarget != null && `距目標 ${distToTarget > 0 ? '-' : '+'}${Math.abs(distToTarget).toFixed(1)} kg`}
              {fourWeekRate != null && `　近4週均速 ${fourWeekRate > 0 ? '+' : ''}${fourWeekRate.toFixed(2)} kg/週`}
              {etaWeeks != null && `　→ 預計 ${etaWeeks.toFixed(1)} 週`}
            </p>
          )}
        </div>
      )}

      {/* Target editor */}
      {editingTarget && (
        <div className="bg-white rounded-2xl border p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">設定目標</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">目標體重 (kg)</label>
              <input
                type="number" step="0.1"
                value={targetForm.target_weight_kg}
                onChange={e => setTargetForm(p => ({ ...p, target_weight_kg: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                placeholder="e.g. 68.0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">每週目標 (kg)</label>
              <input
                type="number" step="0.1"
                value={targetForm.weekly_target_rate}
                onChange={e => setTargetForm(p => ({ ...p, weekly_target_rate: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                placeholder="e.g. -0.5"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveTargets} disabled={targetSaving} className="flex-1 bg-green-500 hover:bg-green-600 h-8 text-xs">
              {targetSaving ? '儲存中...' : '儲存'}
            </Button>
            <Button variant="outline" onClick={() => setEditingTarget(false)} className="flex-1 h-8 text-xs">
              取消
            </Button>
          </div>
        </div>
      )}

      {/* No target set prompt */}
      {targetWeight == null && !editingTarget && (
        <button
          onClick={() => setEditingTarget(true)}
          className="w-full bg-white rounded-2xl border border-dashed p-4 text-sm text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors"
        >
          + 設定體重目標
        </button>
      )}

      {/* Latest stats row */}
      {latestAll && (
        <div className="grid grid-cols-4 gap-2">
          {METRICS.map(m => {
            const v = latestAll[m.key]
            return (
              <div key={m.key} className="bg-white rounded-xl border p-3 text-center">
                <p className="text-base font-bold text-gray-800">
                  {v != null ? (m.key === 'visceral_fat' ? v : Number(v).toFixed(1)) : '—'}
                </p>
                <p className="text-xs text-gray-400">{m.label}{m.unit ? ` (${m.unit})` : ''}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-2xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-wrap gap-1">
            {METRICS.map(m => (
              <button
                key={m.key}
                onClick={() => setActiveMetric(m.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeMetric === m.key ? 'text-white' : 'bg-gray-100 text-gray-500'
                }`}
                style={activeMetric === m.key ? { backgroundColor: m.color } : undefined}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-1 mb-3">
          {RANGES.map(r => (
            <button
              key={r.weeks}
              onClick={() => setRangeWeeks(r.weeks)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                rangeWeeks === r.weeks ? 'border-indigo-400 text-indigo-600 bg-indigo-50' : 'border-gray-200 text-gray-400'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {points.length > 1 ? (
          <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H + 20}`} className="w-full" style={{ minWidth: '240px' }}>
              <polyline
                points={points.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={metaDef.color}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {points.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="3" fill={metaDef.color} />
                  {(i === 0 || i === points.length - 1 || points.length <= 8) && (
                    <text x={p.x} y={p.y - 6} textAnchor="middle" fontSize="9" fill="#6b7280">
                      {formatValue(p.value, activeMetric)}
                    </text>
                  )}
                  {(i === 0 || i === points.length - 1 || points.length <= 8) && (
                    <text x={p.x} y={CHART_H + 16} textAnchor="middle" fontSize="8" fill="#9ca3af">
                      {p.label}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-gray-400">
            {chartValues.length === 0 ? '尚無資料' : '資料點不足以繪圖'}
          </div>
        )}
        <p className="text-xs text-gray-400 text-center mt-1">
          {metaDef.label}（{metaDef.unit || '單位'}）· 每週基準值平均
        </p>
      </div>
    </div>
  )
}

// ─── Diet Correlation Tab ─────────────────────────────────────────────────────

interface DietTabProps {
  profile: Profile
  data: Array<{date: string, calories: number, protein: number, weight: number | null}>
}

function DietTab({ profile, data }: DietTabProps) {
  const goal = profile.goal

  const recent30 = data.slice(-30)
  const avgCal = recent30.length
    ? Math.round(recent30.filter(d => d.calories > 0).reduce((s, d) => s + d.calories, 0) / (recent30.filter(d => d.calories > 0).length || 1))
    : 0
  const avgProtein = recent30.length
    ? parseFloat((recent30.filter(d => d.protein > 0).reduce((s, d) => s + d.protein, 0) / (recent30.filter(d => d.protein > 0).length || 1)).toFixed(1))
    : 0
  const calTarget = profile.calorie_target
  const proteinTarget = profile.protein_target
  const avgDelta = avgCal - calTarget

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="bg-white rounded-2xl border p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">近30天平均</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-orange-50 rounded-xl p-3">
            <p className="text-lg font-bold text-orange-600">{avgCal}</p>
            <p className="text-xs text-gray-400">熱量 kcal</p>
            <p className="text-xs font-medium mt-0.5" style={{ color: avgDelta > 0 ? '#ef4444' : '#22c55e' }}>
              {avgDelta > 0 ? '+' : ''}{avgDelta} vs 目標
            </p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-lg font-bold text-blue-600">{avgProtein}g</p>
            <p className="text-xs text-gray-400">蛋白質</p>
            <p className="text-xs font-medium mt-0.5" style={{ color: avgProtein >= proteinTarget ? '#22c55e' : '#ef4444' }}>
              目標 {proteinTarget}g
            </p>
          </div>
          <div className="bg-indigo-50 rounded-xl p-3">
            <p className="text-lg font-bold text-indigo-600">
              {goal === 'cut' ? '減脂' : goal === 'bulk' ? '增肌' : '維持'}
            </p>
            <p className="text-xs text-gray-400">目前模式</p>
          </div>
        </div>
      </div>

      {/* Daily breakdown */}
      <div className="bg-white rounded-2xl border p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">飲食 × 體重對照（近30天）</p>
        {recent30.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">尚無資料</p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {[...recent30].reverse().map(d => (
              <div key={d.date} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-400 w-16 shrink-0">{format(parseISO(d.date), 'M/d')}</span>
                <div className="flex-1 space-y-0.5">
                  {d.calories > 0 && (
                    <div className="flex items-center gap-1">
                      <div
                        className="h-2 rounded-full bg-orange-400"
                        style={{ width: `${Math.min((d.calories / (calTarget * 1.5)) * 100, 100)}%` }}
                      />
                      <span className="text-xs text-gray-500">{d.calories} kcal</span>
                    </div>
                  )}
                  {d.protein > 0 && (
                    <div className="flex items-center gap-1">
                      <div
                        className="h-1.5 rounded-full bg-blue-400"
                        style={{ width: `${Math.min((d.protein / (proteinTarget * 1.5)) * 100, 100)}%` }}
                      />
                      <span className="text-xs text-gray-400">{d.protein}g 蛋白</span>
                    </div>
                  )}
                </div>
                <span className="text-xs font-medium text-indigo-600 w-12 text-right shrink-0">
                  {d.weight != null ? `${d.weight.toFixed(1)}` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── History Tab ──────────────────────────────────────────────────────────────

interface HistoryTabProps {
  metrics: BodyMetric[]
  onEdit: (m: BodyMetric) => void
  onDelete: (id: string) => void
}

function HistoryTab({ metrics, onEdit, onDelete }: HistoryTabProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  if (metrics.length === 0) {
    return (
      <div className="text-center py-16 text-sm text-gray-400">
        尚無記錄，點右上角「+ 記錄」開始
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {metrics.map(m => (
        <div key={m.id} className="bg-white rounded-2xl border p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {format(parseISO(m.recorded_at), 'yyyy/MM/dd HH:mm')}
              </p>
              {m.is_first_of_day && (
                <span className="text-xs text-green-600 bg-green-50 rounded-full px-2 py-0.5 mt-0.5 inline-block">今日基準</span>
              )}
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => onEdit(m)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setConfirmDelete(m.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {METRICS.map(met => {
              const v = m[met.key]
              return (
                <div key={met.key}>
                  <p className="text-sm font-bold" style={{ color: v != null ? met.color : '#d1d5db' }}>
                    {v != null ? (met.key === 'visceral_fat' ? String(v) : Number(v).toFixed(1)) : '—'}
                  </p>
                  <p className="text-xs text-gray-400">{met.label}</p>
                </div>
              )
            })}
          </div>
          {m.note && <p className="text-xs text-gray-400 mt-2 border-t pt-2">{m.note}</p>}

          {/* Delete confirm */}
          {confirmDelete === m.id && (
            <div className="mt-2 border-t pt-2 flex gap-2">
              <button
                onClick={() => { onDelete(m.id); setConfirmDelete(null) }}
                className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium"
              >
                確認刪除
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-1.5 rounded-lg border text-xs text-gray-500"
              >
                取消
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { calcBMR, calcCalorieTarget, calcProteinTarget } from '@/lib/nutrition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BottomNav } from '@/components/layout/BottomNav'
import { PersonSwitcher } from '@/components/diary/PersonSwitcher'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { ActivityLevel, GoalType, Profile } from '@/types'

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: '久坐（幾乎不運動）',
  light: '輕度（每週 1-3 天）',
  moderate: '中度（每週 3-5 天）',
  active: '積極（每週 6-7 天）',
  very_active: '非常積極（每天高強度）',
}

const GOAL_LABELS: Record<GoalType, string> = {
  cut: '減脂',
  maintain: '維持體重',
  bulk: '增肌',
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { activeSlot, setActiveSlot, profiles, setProfiles, activeProfile } = useAppStore()
  const profile = activeProfile()

  const [profilesState, setProfilesState] = useState<'loading' | 'ready' | 'no-auth'>('loading')
  const [form, setForm] = useState({
    display_name: '',
    birth_year: '',
    height_cm: '',
    weight_kg: '',
    activity_level: 'moderate' as ActivityLevel,
    goal: 'maintain' as GoalType,
  })
  const [autoWeight, setAutoWeight] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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

  useEffect(() => {
    async function loadLastWeekAvgWeight() {
      if (!profile) return
      setAutoWeight(null)
      const now = new Date()
      const dayOfWeek = now.getDay() // 0=Sun
      const diffToLastMon = dayOfWeek === 0 ? 13 : dayOfWeek + 6
      const lastMon = new Date(now); lastMon.setDate(now.getDate() - diffToLastMon); lastMon.setHours(0,0,0,0)
      const lastSun = new Date(lastMon); lastSun.setDate(lastMon.getDate() + 6); lastSun.setHours(23,59,59,999)
      const { data } = await supabase
        .from('body_metrics')
        .select('weight_kg')
        .eq('profile_id', profile.id)
        .eq('is_first_of_day', true)
        .gte('recorded_at', lastMon.toISOString())
        .lte('recorded_at', lastSun.toISOString())
      const vals = (data || []).map((r: Record<string, unknown>) => Number(r.weight_kg)).filter(v => !isNaN(v) && v > 0)
      if (vals.length > 0) {
        const avg = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1))
        setAutoWeight(avg)
        setForm(p => ({ ...p, weight_kg: String(avg) }))
      }
    }
    if (profile) loadLastWeekAvgWeight()
  }, [activeSlot, profiles])

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name,
        birth_year: String(profile.birth_year),
        height_cm: String(profile.height_cm),
        weight_kg: String(profile.weight_kg || 65),
        activity_level: profile.activity_level,
        goal: profile.goal,
      })
    }
  }, [activeSlot, profiles])

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    const weightKg = parseFloat(form.weight_kg) || 65
    const bmr = calcBMR(profile.gender, weightKg, parseFloat(form.height_cm), parseInt(form.birth_year))

    const updates = {
      display_name: form.display_name,
      birth_year: parseInt(form.birth_year),
      height_cm: parseFloat(form.height_cm),
      weight_kg: weightKg,
      activity_level: form.activity_level,
      goal: form.goal,
      calorie_target: calcCalorieTarget(bmr, form.activity_level, form.goal),
      protein_target: calcProteinTarget(weightKg, form.goal),
    }

    const { data } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id)
      .select()
      .single()

    if (data) {
      setProfiles(profiles.map(p => p.id === data.id ? data as Profile : p))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

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

  const weightKg = parseFloat(form.weight_kg) || 65
  const bmr = calcBMR(profile.gender, weightKg, parseFloat(form.height_cm) || 170, parseInt(form.birth_year) || 1990)
  const calTarget = calcCalorieTarget(bmr, form.activity_level, form.goal)
  const proteinTarget = calcProteinTarget(weightKg, form.goal)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          {profiles.length > 0 && (
            <PersonSwitcher profiles={profiles} activeSlot={activeSlot} onSwitch={setActiveSlot} />
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">個人資料</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>稱呼</Label>
              <Input value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>出生年份</Label>
                <Input type="number" value={form.birth_year} onChange={e => setForm(p => ({ ...p, birth_year: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>身高 (cm)</Label>
                <Input type="number" value={form.height_cm} onChange={e => setForm(p => ({ ...p, height_cm: e.target.value }))} step="0.1" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>目前體重 (kg)</Label>
                {autoWeight != null && (
                  <span className="text-xs text-green-600 bg-green-50 rounded-full px-2 py-0.5">上週均值自動帶入</span>
                )}
              </div>
              <Input
                type="number"
                value={form.weight_kg}
                onChange={e => { setAutoWeight(null); setForm(p => ({ ...p, weight_kg: e.target.value })) }}
                step="0.1"
                readOnly={autoWeight != null}
                className={autoWeight != null ? 'bg-gray-50 text-gray-500' : ''}
              />
              {autoWeight == null && (
                <p className="text-xs text-gray-400">到「體組成」頁面記錄後，此欄將自動帶入上週均值</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>活動量</Label>
              <Select value={form.activity_level} onValueChange={v => v && setForm(p => ({ ...p, activity_level: v as ActivityLevel }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTIVITY_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>目標</Label>
              <Select value={form.goal} onValueChange={v => v && setForm(p => ({ ...p, goal: v as GoalType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(GOAL_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Calculated targets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">計算目標</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-gray-800">{Math.round(bmr)}</p>
                <p className="text-xs text-gray-400 mt-0.5">基礎代謝 kcal</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-green-700">{calTarget}</p>
                <p className="text-xs text-gray-400 mt-0.5">每日熱量目標</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-blue-700">{proteinTarget}g</p>
                <p className="text-xs text-gray-400 mt-0.5">蛋白質目標</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-green-500 hover:bg-green-600"
        >
          {saved ? '已儲存 ✓' : saving ? '儲存中...' : '儲存設定'}
        </Button>

        <Button variant="outline" onClick={handleLogout} className="w-full gap-2 text-gray-500">
          <LogOut className="h-4 w-4" />
          登出
        </Button>
      </div>

      <BottomNav />
    </div>
  )
}

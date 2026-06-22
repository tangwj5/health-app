'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, addDays, subDays, isToday, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { MealSection } from '@/components/diary/MealSection'
import { NutritionSummary } from '@/components/diary/NutritionSummary'
import { PersonSwitcher } from '@/components/diary/PersonSwitcher'
import { BottomNav } from '@/components/layout/BottomNav'
import { EditEntryDialog } from '@/components/food/EditEntryDialog'
import { WeeklyNutritionChart } from '@/components/diary/WeeklyNutritionChart'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { MealEntry, MealType, Profile } from '@/types'

const MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '點心' },
]

export default function DiaryPage() {
  const router = useRouter()
  const supabase = createClient()
  const { activeSlot, setActiveSlot, profiles, setProfiles, selectedDate, setSelectedDate, activeProfile } = useAppStore()
  const [entries, setEntries] = useState<MealEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [profilesState, setProfilesState] = useState<'loading' | 'ready' | 'no-auth'>('loading')
  const [editingEntry, setEditingEntry] = useState<MealEntry | null>(null)
  const [exerciseCalories, setExerciseCalories] = useState(0)

  useEffect(() => {
    loadProfiles()
  }, [])

  useEffect(() => {
    if (activeProfile()) {
      loadEntries()
      loadExerciseCalories()
    }
  }, [activeSlot, selectedDate, profiles])

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

  async function loadExerciseCalories() {
    const profile = activeProfile()
    if (!profile) return
    const { data } = await supabase
      .from('exercises')
      .select('calories_est')
      .eq('profile_id', profile.id)
      .gte('recorded_at', `${selectedDate}T00:00:00`)
      .lte('recorded_at', `${selectedDate}T23:59:59`)
    const total = ((data || []) as { calories_est: number }[]).reduce((s, e) => s + (e.calories_est || 0), 0)
    setExerciseCalories(total)
  }

  async function loadEntries() {
    const profile = activeProfile()
    if (!profile) return
    setLoading(true)
    const { data } = await supabase
      .from('meal_entries')
      .select('*, food:foods(*)')
      .eq('profile_id', profile.id)
      .eq('log_date', selectedDate)
      .order('created_at')
    setEntries((data as MealEntry[]) || [])
    setLoading(false)
  }

  async function deleteEntry(id: string) {
    await supabase.from('meal_entries').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  async function copyYesterday(mealType: MealType) {
    const profile = activeProfile()
    if (!profile) return
    const yesterday = format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd')
    const { data: yesterdayEntries } = await supabase
      .from('meal_entries')
      .select('*')
      .eq('profile_id', profile.id)
      .eq('log_date', yesterday)
      .eq('meal_type', mealType)
    if (!yesterdayEntries || yesterdayEntries.length === 0) return

    const newEntries = yesterdayEntries.map(({ id, created_at, ...rest }: MealEntry) => ({
      ...rest,
      log_date: selectedDate,
    }))
    const { data } = await supabase
      .from('meal_entries')
      .insert(newEntries)
      .select('*, food:foods(*)')
    if (data) setEntries(prev => [...prev, ...(data as MealEntry[])])
  }

  const profile = activeProfile()
  const dateObj = parseISO(selectedDate)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          {profilesState === 'loading' ? (
            <div className="h-9 bg-gray-100 rounded-full animate-pulse" />
          ) : profilesState === 'no-auth' ? (
            <a href="/login" className="block text-center py-1.5 px-4 bg-green-500 text-white rounded-full text-sm font-medium">
              請先登入
            </a>
          ) : (
            <PersonSwitcher
              profiles={profiles}
              activeSlot={activeSlot}
              onSwitch={setActiveSlot}
            />
          )}
          {/* Date picker */}
          <div className="flex items-center justify-between mt-3">
            <button onClick={() => setSelectedDate(format(subDays(dateObj, 1), 'yyyy-MM-dd'))}
              className="p-1 rounded-full hover:bg-gray-100">
              <ChevronLeft className="h-5 w-5 text-gray-500" />
            </button>
            <button
              onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
              className="text-center"
            >
              <p className="font-semibold text-gray-800">
                {isToday(dateObj) ? '今天' : format(dateObj, 'M月d日', { locale: zhTW })}
              </p>
              <p className="text-xs text-gray-400">{format(dateObj, 'yyyy/MM/dd')}</p>
            </button>
            <button onClick={() => setSelectedDate(format(addDays(dateObj, 1), 'yyyy-MM-dd'))}
              className="p-1 rounded-full hover:bg-gray-100">
              <ChevronRight className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {/* Nutrition summary */}
        {profile && (
          <NutritionSummary
            entries={entries}
            calorieTarget={profile.calorie_target}
            proteinTarget={profile.protein_target}
            exerciseCalories={exerciseCalories}
          />
        )}

        {/* Weekly chart */}
        {profile && (
          <WeeklyNutritionChart
            profileId={profile.id}
            selectedDate={selectedDate}
            calorieTarget={profile.calorie_target}
            proteinTarget={profile.protein_target}
          />
        )}

        {/* Meal sections */}
        {MEAL_TYPES.map(({ key, label }) => (
          <MealSection
            key={key}
            mealType={key}
            label={label}
            entries={entries.filter(e => e.meal_type === key)}
            profileId={profile?.id || ''}
            selectedDate={selectedDate}
            onDelete={deleteEntry}
            onEdit={setEditingEntry}
            onCopyYesterday={() => copyYesterday(key)}
            onAddEntry={() => router.push(`/search?meal=${key}&date=${selectedDate}`)}
            onRefresh={loadEntries}
          />
        ))}

        {editingEntry && (
          <EditEntryDialog
            entry={editingEntry}
            onClose={() => setEditingEntry(null)}
            onSaved={() => { setEditingEntry(null); loadEntries() }}
          />
        )}
      </div>

      <BottomNav />
    </div>
  )
}

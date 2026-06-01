'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calcCalorieTarget, calcProteinTarget, calcBMR } from '@/lib/nutrition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Gender, ActivityLevel, GoalType } from '@/types'

interface PersonForm {
  display_name: string
  gender: Gender
  birth_year: string
  height_cm: string
  weight_kg: string
  activity_level: ActivityLevel
  goal: GoalType
}

const defaultForm = (): PersonForm => ({
  display_name: '',
  gender: 'male',
  birth_year: '1990',
  height_cm: '170',
  weight_kg: '65',
  activity_level: 'moderate',
  goal: 'maintain',
})

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: '久坐（幾乎不運動）',
  light: '輕度（每週運動 1-3 天）',
  moderate: '中度（每週運動 3-5 天）',
  active: '積極（每週運動 6-7 天）',
  very_active: '非常積極（每天高強度運動）',
}

const GOAL_LABELS: Record<GoalType, string> = {
  cut: '減脂',
  maintain: '維持體重',
  bulk: '增肌',
}

export default function SetupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<1 | 2>(1)
  const [person1, setPerson1] = useState<PersonForm>(defaultForm())
  const [person2, setPerson2] = useState<PersonForm>(defaultForm())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const currentForm = step === 1 ? person1 : person2
  const setCurrentForm = step === 1 ? setPerson1 : setPerson2

  function updateField(field: keyof PersonForm, value: string) {
    setCurrentForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (step === 1) {
      setStep(2)
      return
    }

    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('請重新登入'); setLoading(false); return }

    const profiles = [person1, person2].map((p, i) => {
      const weightKg = parseFloat(p.weight_kg) || 65
      const bmr = calcBMR(p.gender, weightKg, parseFloat(p.height_cm), parseInt(p.birth_year))
      return {
        auth_user_id: user.id,
        slot: (i + 1) as 1 | 2,
        display_name: p.display_name,
        gender: p.gender,
        birth_year: parseInt(p.birth_year),
        height_cm: parseFloat(p.height_cm),
        weight_kg: weightKg,
        activity_level: p.activity_level,
        goal: p.goal,
        calorie_target: calcCalorieTarget(bmr, p.activity_level, p.goal),
        protein_target: calcProteinTarget(weightKg, p.goal),
      }
    })

    const { error } = await supabase.from('profiles').insert(profiles)
    if (error) {
      setError('建立失敗，請再試一次')
    } else {
      router.push('/diary')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-green-500' : 'bg-gray-200'}`} />
            <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-green-500' : 'bg-gray-200'}`} />
          </div>
          <CardTitle>
            {step === 1 ? '第一位家庭成員' : '第二位家庭成員'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            建立基本資料來計算每日熱量目標
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>稱呼（顯示名稱）</Label>
              <Input
                value={currentForm.display_name}
                onChange={e => updateField('display_name', e.target.value)}
                placeholder={step === 1 ? '例如：小明、媽媽' : '例如：小美、爸爸'}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>性別</Label>
                <Select value={currentForm.gender} onValueChange={v => v && updateField('gender', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">男</SelectItem>
                    <SelectItem value="female">女</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>出生年份</Label>
                <Input
                  type="number"
                  value={currentForm.birth_year}
                  onChange={e => updateField('birth_year', e.target.value)}
                  min={1940}
                  max={2010}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>身高（cm）</Label>
                <Input
                  type="number"
                  value={currentForm.height_cm}
                  onChange={e => updateField('height_cm', e.target.value)}
                  min={100}
                  max={220}
                  step={0.1}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>體重（kg）</Label>
                <Input
                  type="number"
                  value={currentForm.weight_kg}
                  onChange={e => updateField('weight_kg', e.target.value)}
                  min={30}
                  max={200}
                  step={0.1}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>活動量</Label>
              <Select value={currentForm.activity_level} onValueChange={v => v && updateField('activity_level', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTIVITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>目標</Label>
              <Select value={currentForm.goal} onValueChange={v => v && updateField('goal', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(GOAL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-2">
              {step === 2 && (
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                  上一步
                </Button>
              )}
              <Button type="submit" className="flex-1 bg-green-500 hover:bg-green-600" disabled={loading}>
                {loading ? '建立中...' : step === 1 ? '下一位 →' : '完成設定'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

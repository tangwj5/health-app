'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { estimateCalories, INTENSITY_LABELS, BODY_PARTS } from '@/lib/exercise'
import type { ExerciseType, Intensity } from '@/types'

function nowLocalDatetimeStr() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

interface Props {
  profileId: string
  weightKg: number
  onClose: () => void
  onSaved: () => void
}

export function ExerciseDialog({ profileId, weightKg, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [recordedAt, setRecordedAt] = useState(nowLocalDatetimeStr())
  const [type, setType] = useState<ExerciseType>('walking')
  const [bodyParts, setBodyParts] = useState<string[]>([])
  const [intensity, setIntensity] = useState<Intensity>('moderate')
  const [duration, setDuration] = useState('30')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const durationMin = parseInt(duration) || 0
  const cals = durationMin > 0 ? estimateCalories(type, intensity, durationMin, weightKg) : 0

  function togglePart(part: string) {
    setBodyParts(p => p.includes(part) ? p.filter(x => x !== part) : [...p, part])
  }

  async function handleSave() {
    if (durationMin <= 0) { setError('請填入運動時間'); return }
    setSaving(true); setError(null)
    const { error: err } = await supabase.from('exercises').insert({
      profile_id: profileId,
      recorded_at: new Date(recordedAt).toISOString(),
      exercise_type: type,
      body_parts: type === 'strength' ? bodyParts : [],
      intensity,
      duration_min: durationMin,
      calories_est: cals,
      note: note || null,
    })
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false)
    onSaved()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle>記錄運動</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>記錄時間</Label>
            <Input type="datetime-local" value={recordedAt} onChange={e => setRecordedAt(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>運動類型</Label>
            <div className="flex gap-2">
              {(['walking', 'strength'] as ExerciseType[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setType(t); setBodyParts([]) }}
                  className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors ${
                    type === t ? 'border-green-500 text-green-600 bg-green-50' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {t === 'walking' ? '🚶 走路' : '🏋️ 重訓'}
                </button>
              ))}
            </div>
          </div>

          {type === 'strength' && (
            <div className="space-y-1">
              <Label>訓練部位（可複選）</Label>
              <div className="flex flex-wrap gap-2">
                {BODY_PARTS.map(part => (
                  <button
                    key={part}
                    onClick={() => togglePart(part)}
                    className={`px-3 py-1.5 rounded-full text-xs border font-medium transition-colors ${
                      bodyParts.includes(part)
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    {part}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>強度</Label>
            <div className="flex gap-2">
              {(['easy', 'moderate', 'hard'] as Intensity[]).map(i => (
                <button
                  key={i}
                  onClick={() => setIntensity(i)}
                  className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors ${
                    intensity === i ? 'border-orange-400 text-orange-600 bg-orange-50' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {INTENSITY_LABELS[i]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>時間（分鐘）</Label>
            <Input
              type="number" min="1"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="30"
            />
          </div>

          {cals > 0 && (
            <div className="bg-orange-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-orange-600">{cals} kcal</p>
              <p className="text-xs text-gray-400">估算消耗熱量</p>
            </div>
          )}

          <div className="space-y-1">
            <Label>備註</Label>
            <Input placeholder="（選填）" value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <Button onClick={handleSave} disabled={saving} className="w-full bg-green-500 hover:bg-green-600">
            {saving ? '儲存中...' : '新增記錄'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

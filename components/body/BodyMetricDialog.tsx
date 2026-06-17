'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BodyMetric } from '@/types'

interface Props {
  profileId: string
  initial?: BodyMetric
  onClose: () => void
  onSaved: () => void
}

function toLocalDatetimeStr(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function nowLocalDatetimeStr() {
  return toLocalDatetimeStr(new Date().toISOString())
}

export function BodyMetricDialog({ profileId, initial, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [form, setForm] = useState({
    recorded_at: initial ? toLocalDatetimeStr(initial.recorded_at) : nowLocalDatetimeStr(),
    weight_kg: initial?.weight_kg != null ? String(initial.weight_kg) : '',
    body_fat_pct: initial?.body_fat_pct != null ? String(initial.body_fat_pct) : '',
    muscle_kg: initial?.muscle_kg != null ? String(initial.muscle_kg) : '',
    visceral_fat: initial?.visceral_fat != null ? String(initial.visceral_fat) : '',
    is_first_of_day: initial?.is_first_of_day ?? false,
    note: initial?.note ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function field(key: string, val: string) {
    setForm(p => ({ ...p, [key]: val }))
  }

  async function handleSave() {
    if (!form.recorded_at) { setError('請填入記錄時間'); return }
    setSaving(true)
    setError(null)

    const payload = {
      profile_id: profileId,
      recorded_at: new Date(form.recorded_at).toISOString(),
      weight_kg: form.weight_kg !== '' ? parseFloat(form.weight_kg) : null,
      body_fat_pct: form.body_fat_pct !== '' ? parseFloat(form.body_fat_pct) : null,
      muscle_kg: form.muscle_kg !== '' ? parseFloat(form.muscle_kg) : null,
      visceral_fat: form.visceral_fat !== '' ? parseFloat(form.visceral_fat) : null,
      is_first_of_day: form.is_first_of_day,
      note: form.note || null,
    }

    let err
    if (initial) {
      ;({ error: err } = await supabase.from('body_metrics').update(payload).eq('id', initial.id))
    } else {
      ;({ error: err } = await supabase.from('body_metrics').insert(payload))
    }

    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false)
    onSaved()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? '編輯記錄' : '新增體組成記錄'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>記錄時間</Label>
            <Input
              type="datetime-local"
              value={form.recorded_at}
              onChange={e => field('recorded_at', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>體重 (kg)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="—"
                value={form.weight_kg}
                onChange={e => field('weight_kg', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>體脂肪 (%)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="—"
                value={form.body_fat_pct}
                onChange={e => field('body_fat_pct', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>肌肉量 (kg)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="—"
                value={form.muscle_kg}
                onChange={e => field('muscle_kg', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>內臟脂肪</Label>
              <Input
                type="number"
                step="0.5"
                placeholder="—"
                value={form.visceral_fat}
                onChange={e => field('visceral_fat', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>備註</Label>
            <Input
              placeholder="（選填）"
              value={form.note}
              onChange={e => field('note', e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_first_of_day}
              onChange={e => setForm(p => ({ ...p, is_first_of_day: e.target.checked }))}
              className="w-4 h-4 rounded accent-green-500"
            />
            <span className="text-sm text-gray-700">今日第一次量測（基準值）</span>
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <Button onClick={handleSave} disabled={saving} className="w-full bg-green-500 hover:bg-green-600">
            {saving ? '儲存中...' : initial ? '更新記錄' : '新增記錄'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

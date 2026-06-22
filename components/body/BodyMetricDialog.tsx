'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BodyMetric } from '@/types'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeDecRange(from: number, to: number, step: number): string[] {
  const arr: string[] = []
  const steps = Math.round((to - from) / step)
  for (let i = 0; i <= steps; i++) {
    const val = from + i * step
    arr.push(val.toFixed(1))
  }
  return arr
}

function toLocalDatetimeStr(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function nowLocalDatetimeStr() { return toLocalDatetimeStr(new Date().toISOString()) }

function findNearest(items: string[], val: number | null | undefined, fallback: string): string {
  if (val == null) return fallback
  const target = val
  let best = items[0]
  let bestDiff = Math.abs(parseFloat(items[0]) - target)
  for (const item of items) {
    const diff = Math.abs(parseFloat(item) - target)
    if (diff < bestDiff) { bestDiff = diff; best = item }
  }
  return best
}

// ── Drum ─────────────────────────────────────────────────────────────────────

const ITEM_H = 44
const VISIBLE = 5

interface DrumProps {
  items: string[]
  value: string
  onChange: (v: string) => void
  width?: number
}

function Drum({ items, value, onChange, width = 96 }: DrumProps) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(false)

  // scroll to initial position on mount
  useEffect(() => {
    const el = ref.current
    if (!el || mounted.current) return
    mounted.current = true
    const idx = Math.max(0, items.indexOf(value))
    el.scrollTop = idx * ITEM_H
  }, [])

  const handleScroll = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)))
      onChange(items[i])
    }, 80)
  }, [items, onChange])

  return (
    <div style={{ width, height: ITEM_H * VISIBLE, position: 'relative', overflow: 'hidden' }}>
      {/* selection band */}
      <div style={{
        position: 'absolute', top: ITEM_H * 2, left: 0, right: 0, height: ITEM_H,
        background: 'rgba(16,185,129,0.07)',
        borderTop: '1.5px solid #bbf7d0', borderBottom: '1.5px solid #bbf7d0',
        pointerEvents: 'none', zIndex: 1,
      }} />
      {/* top fade */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H * 2,
        background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0.1) 100%)',
        pointerEvents: 'none', zIndex: 2,
      }} />
      {/* bottom fade */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H * 2,
        background: 'linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.1) 100%)',
        pointerEvents: 'none', zIndex: 2,
      }} />
      <div
        ref={ref}
        onScroll={handleScroll}
        style={{
          height: '100%',
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          paddingTop: ITEM_H * 2,
          paddingBottom: ITEM_H * 2,
          scrollbarWidth: 'none',
        }}
        className="[&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              height: ITEM_H,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              scrollSnapAlign: 'center',
              fontSize: '20px', fontWeight: '500', color: '#111827',
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── MetricPicker ──────────────────────────────────────────────────────────────

interface MetricPickerProps {
  label: string
  unit: string
  items: string[]
  value: string
  onChange: (v: string) => void
}

function MetricPicker({ label, unit, items, value, onChange }: MetricPickerProps) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-1">
        <Drum items={items} value={value} onChange={onChange} width={96} />
        <span className="text-xs text-gray-400 w-6">{unit}</span>
      </div>
    </div>
  )
}

// ── Props & main dialog ───────────────────────────────────────────────────────

interface Props {
  profileId: string
  initial?: BodyMetric
  lastValues?: BodyMetric
  onClose: () => void
  onSaved: () => void
}

const WEIGHT_ITEMS   = makeDecRange(30, 150, 0.1)
const FATPCT_ITEMS   = makeDecRange(3, 60, 0.1)
const MUSCLE_ITEMS   = makeDecRange(10, 80, 0.1)
const VISCERAL_ITEMS = makeDecRange(1, 30, 0.5)

export function BodyMetricDialog({ profileId, initial, lastValues, onClose, onSaved }: Props) {
  const supabase = createClient()
  const src = initial ?? lastValues  // source for pre-filling

  const [recordedAt, setRecordedAt] = useState(
    initial ? toLocalDatetimeStr(initial.recorded_at) : nowLocalDatetimeStr()
  )
  const [isFirstOfDay, setIsFirstOfDay] = useState(initial?.is_first_of_day ?? false)
  const [note, setNote] = useState(initial?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // single value state for each metric
  const [wVal,  setWVal]  = useState(() => findNearest(WEIGHT_ITEMS,   src?.weight_kg,    '70.0'))
  const [bfVal, setBfVal] = useState(() => findNearest(FATPCT_ITEMS,   src?.body_fat_pct, '20.0'))
  const [mVal,  setMVal]  = useState(() => findNearest(MUSCLE_ITEMS,   src?.muscle_kg,    '30.0'))
  const [vVal,  setVVal]  = useState(() => findNearest(VISCERAL_ITEMS, src?.visceral_fat,  '5.0'))

  async function handleSave() {
    if (!recordedAt) { setError('請填入記錄時間'); return }
    setSaving(true)
    setError(null)

    const payload = {
      profile_id:    profileId,
      recorded_at:   new Date(recordedAt).toISOString(),
      weight_kg:     parseFloat(wVal),
      body_fat_pct:  parseFloat(bfVal),
      muscle_kg:     parseFloat(mVal),
      visceral_fat:  parseFloat(vVal),
      is_first_of_day: isFirstOfDay,
      note: note || null,
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
      <DialogContent className="max-w-sm mx-4 max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? '編輯記錄' : '新增體組成記錄'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* datetime */}
          <div className="space-y-1">
            <Label>記錄時間</Label>
            <Input type="datetime-local" value={recordedAt} onChange={e => setRecordedAt(e.target.value)} />
          </div>

          {/* drums – 2×2 grid */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-4 bg-gray-50 rounded-2xl p-3">
            <MetricPicker
              label="體重" unit="kg"
              items={WEIGHT_ITEMS} value={wVal} onChange={setWVal}
            />
            <MetricPicker
              label="體脂" unit="%"
              items={FATPCT_ITEMS} value={bfVal} onChange={setBfVal}
            />
            <MetricPicker
              label="肌肉" unit="kg"
              items={MUSCLE_ITEMS} value={mVal} onChange={setMVal}
            />
            <MetricPicker
              label="內臟脂肪" unit=""
              items={VISCERAL_ITEMS} value={vVal} onChange={setVVal}
            />
          </div>

          {/* is_first_of_day */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isFirstOfDay}
              onChange={e => setIsFirstOfDay(e.target.checked)}
              className="w-4 h-4 rounded accent-green-500"
            />
            <span className="text-sm text-gray-700">今日第一次量測（基準值）</span>
          </label>

          {/* note */}
          <div className="space-y-1">
            <Label>備註</Label>
            <Input placeholder="（選填）" value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <Button onClick={handleSave} disabled={saving} className="w-full bg-green-500 hover:bg-green-600">
            {saving ? '儲存中...' : initial ? '更新記錄' : '新增記錄'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

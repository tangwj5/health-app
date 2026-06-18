'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BodyMetric } from '@/types'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRange(from: number, to: number): string[] {
  const arr: string[] = []
  for (let i = from; i <= to; i++) arr.push(String(i))
  return arr
}

function toLocalDatetimeStr(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function nowLocalDatetimeStr() { return toLocalDatetimeStr(new Date().toISOString()) }

function getInt(val: string | number | null | undefined, fallback: number): string {
  if (val == null || val === '') return String(fallback)
  return String(Math.floor(parseFloat(String(val))))
}
function getDec(val: string | number | null | undefined, fallback = '0', halfStep = false): string {
  if (val == null || val === '') return fallback
  const n = parseFloat(String(val))
  if (isNaN(n)) return fallback
  const frac = n - Math.floor(n)
  if (halfStep) return frac >= 0.3 ? '5' : '0'
  return String(Math.min(9, Math.round(frac * 10)))
}
function joinVal(int: string, dec: string): string { return `${int}.${dec}` }

// ── Drum ─────────────────────────────────────────────────────────────────────

const ITEM_H = 44
const VISIBLE = 5

interface DrumProps {
  items: string[]
  value: string
  onChange: (v: string) => void
  width?: number
}

function Drum({ items, value, onChange, width = 64 }: DrumProps) {
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

// ── MetricPicker row ──────────────────────────────────────────────────────────

const DEC_10 = makeRange(0, 9)
const DEC_HALF = ['0', '5']

interface MetricPickerProps {
  label: string
  unit: string
  intItems: string[]
  decItems?: string[]
  intValue: string
  decValue: string
  onIntChange: (v: string) => void
  onDecChange: (v: string) => void
}

function MetricPicker({ label, unit, intItems, decItems = DEC_10, intValue, decValue, onIntChange, onDecChange }: MetricPickerProps) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-0.5">
        <Drum items={intItems} value={intValue} onChange={onIntChange} width={68} />
        <span className="text-xl text-gray-400 font-light pb-0.5">.</span>
        <Drum items={decItems} value={decValue} onChange={onDecChange} width={44} />
        <span className="text-xs text-gray-400 ml-1 w-6">{unit}</span>
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

const WEIGHT_INT  = makeRange(30, 160)
const FATPCT_INT  = makeRange(3, 60)
const MUSCLE_INT  = makeRange(10, 80)
const VISCERAL_INT = makeRange(1, 30)

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

  // integer + decimal state for each metric
  const [wInt,  setWInt]  = useState(() => getInt(src?.weight_kg,    70))
  const [wDec,  setWDec]  = useState(() => getDec(src?.weight_kg,   '0'))
  const [bfInt, setBfInt] = useState(() => getInt(src?.body_fat_pct, 20))
  const [bfDec, setBfDec] = useState(() => getDec(src?.body_fat_pct,'0'))
  const [mInt,  setMInt]  = useState(() => getInt(src?.muscle_kg,    30))
  const [mDec,  setMDec]  = useState(() => getDec(src?.muscle_kg,   '0'))
  const [vInt,  setVInt]  = useState(() => getInt(src?.visceral_fat,  5))
  const [vDec,  setVDec]  = useState(() => getDec(src?.visceral_fat,'0', true))

  async function handleSave() {
    if (!recordedAt) { setError('請填入記錄時間'); return }
    setSaving(true)
    setError(null)

    const payload = {
      profile_id:    profileId,
      recorded_at:   new Date(recordedAt).toISOString(),
      weight_kg:     parseFloat(joinVal(wInt,  wDec)),
      body_fat_pct:  parseFloat(joinVal(bfInt, bfDec)),
      muscle_kg:     parseFloat(joinVal(mInt,  mDec)),
      visceral_fat:  parseFloat(joinVal(vInt,  vDec)),
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
              intItems={WEIGHT_INT}  decItems={DEC_10}
              intValue={wInt}  decValue={wDec}
              onIntChange={setWInt}  onDecChange={setWDec}
            />
            <MetricPicker
              label="體脂" unit="%"
              intItems={FATPCT_INT}  decItems={DEC_10}
              intValue={bfInt} decValue={bfDec}
              onIntChange={setBfInt} onDecChange={setBfDec}
            />
            <MetricPicker
              label="肌肉" unit="kg"
              intItems={MUSCLE_INT}  decItems={DEC_10}
              intValue={mInt}  decValue={mDec}
              onIntChange={setMInt}  onDecChange={setMDec}
            />
            <MetricPicker
              label="內臟脂肪" unit=""
              intItems={VISCERAL_INT} decItems={DEC_HALF}
              intValue={vInt}  decValue={vDec}
              onIntChange={setVInt}  onDecChange={setVDec}
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

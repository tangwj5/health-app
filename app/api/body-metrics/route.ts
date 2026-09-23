import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { format } from 'date-fns'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TOKEN_SLOT: Record<string, number> = {
  [process.env.BODY_API_TOKEN_YU!]: 1,
  [process.env.BODY_API_TOKEN_NOXEN!]: 2,
}

async function getProfileId(token: string): Promise<string | null> {
  const slot = TOKEN_SLOT[token]
  if (!slot) return null
  const { data } = await supabase.from('profiles').select('id').eq('slot', slot).single()
  return data?.id ?? null
}

const toNum = (v: string | null): number | null => {
  if (v === null || v === undefined || v === '' || v === 'null') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

async function writeMetrics(token: string, weight_kg: string | null, fat_pct: string | null, lean_kg: string | null, visceral_fat: string | null) {
  const profileId = await getProfileId(token)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const todayUtc = format(now, 'yyyy-MM-dd')

  const { data: existing } = await supabase
    .from('body_metrics')
    .select('id')
    .eq('profile_id', profileId)
    .gte('recorded_at', `${todayUtc}T00:00:00.000Z`)
    .lte('recorded_at', `${todayUtc}T23:59:59.999Z`)
    .limit(1)

  const isFirstOfDay = !existing || existing.length === 0

  const { error } = await supabase.from('body_metrics').insert({
    profile_id: profileId,
    weight_kg: toNum(weight_kg),
    body_fat_pct: toNum(fat_pct),
    muscle_kg: toNum(lean_kg),
    visceral_fat: toNum(visceral_fat),
    is_first_of_day: isFirstOfDay,
    recorded_at: now.toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    ok: true,
    is_first_of_day: isFirstOfDay,
    received: { weight_kg: toNum(weight_kg), fat_pct: toNum(fat_pct), lean_kg: toNum(lean_kg), visceral_fat: toNum(visceral_fat) },
  })
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const token = p.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  // If write=1 is present, treat as a write request via query params
  if (p.get('write') === '1') {
    return writeMetrics(token, p.get('weight_kg'), p.get('fat_pct'), p.get('lean_kg'), p.get('visceral_fat'))
  }

  const profileId = await getProfileId(token)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('body_metrics')
    .select('weight_kg, body_fat_pct, muscle_kg, visceral_fat')
    .eq('profile_id', profileId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    weight_kg: data?.weight_kg ?? null,
    body_fat_pct: data?.body_fat_pct ?? null,
    muscle_kg: data?.muscle_kg ?? null,
    visceral_fat: data?.visceral_fat ?? null,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { token, weight_kg, fat_pct, lean_kg, visceral_fat } = body
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  return writeMetrics(token, weight_kg, fat_pct, lean_kg, visceral_fat)
}

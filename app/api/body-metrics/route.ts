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

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const profileId = await getProfileId(token)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('body_metrics')
    .select('weight_kg, body_fat_pct, muscle_kg, visceral_fat')
    .eq('profile_id', profileId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json(data ?? {})
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, weight_kg, fat_pct, lean_kg, visceral_fat } = body

  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

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
    weight_kg: weight_kg ?? null,
    body_fat_pct: fat_pct ?? null,
    muscle_kg: lean_kg ?? null,
    visceral_fat: visceral_fat ?? null,
    is_first_of_day: isFirstOfDay,
    recorded_at: now.toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, is_first_of_day: isFirstOfDay })
}

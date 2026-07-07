import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scheduleToRRule, getNextOccurrence } from '@/lib/schedule'
import type { ScheduleType, ScheduleConfig } from '@/types'

function pad(n: number) { return String(n).padStart(2, '0') }

function formatDate(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
}

function formatDateTime(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const appUrl = new URL(request.url).origin

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new NextResponse('Server not configured', { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('calendar_token', token)
    .single()

  if (!profile) {
    return new NextResponse('Not found', { status: 404 })
  }

  const [{ data: items }, { data: logs }] = await Promise.all([
    supabase
      .from('tracker_items')
      .select('id, name, note, interval_days, schedule_type, schedule_config')
      .eq('profile_id', profile.id)
      .eq('is_active', true),
    supabase
      .from('tracker_logs')
      .select('item_id, completed_at')
      .eq('profile_id', profile.id)
      .order('completed_at', { ascending: false }),
  ])

  const latestLog: Record<string, string> = {}
  for (const log of (logs || []) as { item_id: string; completed_at: string }[]) {
    if (!latestLog[log.item_id]) latestLog[log.item_id] = log.completed_at
  }

  const now = new Date()
  const dtstamp = formatDateTime(now)

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//健康管理//Calendar//TW',
    `X-WR-CALNAME:健康追蹤－${profile.display_name}`,
    'X-WR-CALDESC:頻率事項到期提醒',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-PUBLISHED-TTL:PT6H',
  ]

  type ItemRow = { id: string; name: string; note: string | null; interval_days: number | null; schedule_type: string | null; schedule_config: ScheduleConfig | null }
  for (const item of (items || []) as ItemRow[]) {
    const lastDoneStr = latestLog[item.id]
    const uid = `tracker-${item.id}@health-app`
    const desc = item.note ? item.note.replace(/\n/g, '\\n').replace(/,/g, '\\,') : ''

    if (item.schedule_type) {
      // Fixed-schedule item — use RRULE for recurring events
      const type = item.schedule_type as ScheduleType
      const config = item.schedule_config || {}
      const dtstart = getNextOccurrence(type, config, now)
      dtstart.setHours(0, 0, 0, 0)
      const dtend = new Date(dtstart.getTime() + 24 * 60 * 60 * 1000)
      const rrule = scheduleToRRule(type, config)

      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${uid}`)
      lines.push(`DTSTAMP:${dtstamp}`)
      lines.push(`DTSTART;VALUE=DATE:${formatDate(dtstart)}`)
      lines.push(`DTEND;VALUE=DATE:${formatDate(dtend)}`)
      lines.push(rrule)
      lines.push(`SUMMARY:${item.name}`)
      if (desc) lines.push(`DESCRIPTION:${desc}`)
      lines.push(`URL:${appUrl}/track`)
      lines.push('BEGIN:VALARM')
      lines.push('TRIGGER:-PT0S')
      lines.push('ACTION:DISPLAY')
      lines.push(`DESCRIPTION:${item.name}`)
      lines.push('END:VALARM')
      lines.push('END:VEVENT')
    } else if (item.interval_days) {
      // Interval item — single event for next due date
      const lastDone = lastDoneStr ? new Date(lastDoneStr) : null
      const nextDue = lastDone
        ? new Date(lastDone.getTime() + item.interval_days * 24 * 60 * 60 * 1000)
        : now
      nextDue.setUTCHours(0, 0, 0, 0)
      const nextDuePlusOne = new Date(nextDue.getTime() + 24 * 60 * 60 * 1000)

      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${uid}`)
      lines.push(`DTSTAMP:${dtstamp}`)
      lines.push(`DTSTART;VALUE=DATE:${formatDate(nextDue)}`)
      lines.push(`DTEND;VALUE=DATE:${formatDate(nextDuePlusOne)}`)
      lines.push(`SUMMARY:${item.name}`)
      if (desc) lines.push(`DESCRIPTION:${desc}`)
      lines.push(`URL:${appUrl}/track`)
      lines.push('BEGIN:VALARM')
      lines.push('TRIGGER:-PT0S')
      lines.push('ACTION:DISPLAY')
      lines.push(`DESCRIPTION:${item.name} 到期`)
      lines.push('END:VALARM')
      lines.push('END:VEVENT')
    }
    // Items with no schedule: skip (nothing to remind)
  }

  lines.push('END:VCALENDAR')

  return new NextResponse(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="health-tracker.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}

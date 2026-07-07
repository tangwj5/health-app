import { addDays, subDays, format, parseISO, differenceInCalendarDays } from 'date-fns'
import type { ScheduleType, ScheduleConfig } from '@/types'

// ─── Occurrence helpers ───────────────────────────────────────────────────────

function nthWeekdayOfMonth(year: number, month: number, week: number, dow: number): Date {
  if (week === -1) {
    const lastDay = new Date(year, month + 1, 0)
    let d = new Date(lastDay)
    while (d.getDay() !== dow) d = subDays(d, 1)
    return d
  }
  const firstDay = new Date(year, month, 1)
  let d = new Date(firstDay)
  while (d.getDay() !== dow) d = addDays(d, 1)
  return addDays(d, (week - 1) * 7)
}

// Next occurrence on or after `from`
export function getNextOccurrence(type: ScheduleType, config: ScheduleConfig, from: Date): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)

  switch (type) {
    case 'weekly': {
      const days = config.days || []
      if (days.length === 0) return d
      const todayDow = d.getDay()
      let minDiff = 8
      for (const day of days) {
        const diff = (day - todayDow + 7) % 7
        if (diff < minDiff) minDiff = diff
      }
      return addDays(d, minDiff)
    }
    case 'monthly_date': {
      const targetDay = config.day || 1
      const thisMonth = new Date(d.getFullYear(), d.getMonth(), targetDay)
      return thisMonth >= d ? thisMonth : new Date(d.getFullYear(), d.getMonth() + 1, targetDay)
    }
    case 'monthly_weekday': {
      const week = config.week || 1
      const dow = config.day ?? 1
      const thisOcc = nthWeekdayOfMonth(d.getFullYear(), d.getMonth(), week, dow)
      if (thisOcc >= d) return thisOcc
      const nm = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      return nthWeekdayOfMonth(nm.getFullYear(), nm.getMonth(), week, dow)
    }
    case 'yearly': {
      const m = (config.month || 1) - 1
      const day = config.day || 1
      const thisYear = new Date(d.getFullYear(), m, day)
      return thisYear >= d ? thisYear : new Date(d.getFullYear() + 1, m, day)
    }
  }
}

// Most recent past occurrence on or before `today`
function getLastOccurrence(type: ScheduleType, config: ScheduleConfig, today: Date): Date {
  const d = new Date(today)
  d.setHours(0, 0, 0, 0)

  switch (type) {
    case 'weekly': {
      const days = config.days || []
      for (let i = 0; i <= 6; i++) {
        const check = subDays(d, i)
        if (days.includes(check.getDay())) return check
      }
      return d
    }
    case 'monthly_date': {
      const targetDay = config.day || 1
      const thisMonth = new Date(d.getFullYear(), d.getMonth(), targetDay)
      return thisMonth <= d ? thisMonth : new Date(d.getFullYear(), d.getMonth() - 1, targetDay)
    }
    case 'monthly_weekday': {
      const week = config.week || 1
      const dow = config.day ?? 1
      const thisOcc = nthWeekdayOfMonth(d.getFullYear(), d.getMonth(), week, dow)
      if (thisOcc <= d) return thisOcc
      const pm = new Date(d.getFullYear(), d.getMonth() - 1, 1)
      return nthWeekdayOfMonth(pm.getFullYear(), pm.getMonth(), week, dow)
    }
    case 'yearly': {
      const m = (config.month || 1) - 1
      const day = config.day || 1
      const thisYear = new Date(d.getFullYear(), m, day)
      return thisYear <= d ? thisYear : new Date(d.getFullYear() - 1, m, day)
    }
  }
}

// ─── Status ───────────────────────────────────────────────────────────────────

export interface ScheduleStatus {
  nextDue: Date
  overdueBy: number | null   // days overdue; null = not overdue
  daysUntilDue: number       // 0 = today; negative = overdue
}

export function computeScheduleStatus(
  type: ScheduleType,
  config: ScheduleConfig,
  lastCompletedAt: string | null,
  now: Date,
): ScheduleStatus {
  const lastDone = lastCompletedAt ? parseISO(lastCompletedAt) : null

  // Never completed: just show next occurrence, not overdue
  if (!lastDone) {
    const next = getNextOccurrence(type, config, now)
    return { nextDue: next, overdueBy: null, daysUntilDue: differenceInCalendarDays(next, now) }
  }

  const lastOcc = getLastOccurrence(type, config, now)
  const lastOccStr = format(lastOcc, 'yyyy-MM-dd')
  const lastDoneStr = format(lastDone, 'yyyy-MM-dd')
  const todayStr = format(now, 'yyyy-MM-dd')

  const isDueToday = lastOccStr === todayStr
  const isCompletedThisPeriod = lastDoneStr >= lastOccStr

  if (isCompletedThisPeriod) {
    // Done — next occurrence strictly after today
    const next = getNextOccurrence(type, config, addDays(now, 1))
    return { nextDue: next, overdueBy: null, daysUntilDue: differenceInCalendarDays(next, now) }
  }

  if (isDueToday) {
    // Due today, not yet done
    return { nextDue: lastOcc, overdueBy: null, daysUntilDue: 0 }
  }

  // Past due
  const overdueBy = differenceInCalendarDays(now, lastOcc)
  return { nextDue: lastOcc, overdueBy, daysUntilDue: -overdueBy }
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const DOW_ZH = ['日', '一', '二', '三', '四', '五', '六']

export function scheduleLabel(type: ScheduleType, config: ScheduleConfig): string {
  switch (type) {
    case 'weekly': {
      const sorted = [...(config.days || [])].sort((a, b) => {
        const order = [1, 2, 3, 4, 5, 6, 0]
        return order.indexOf(a) - order.indexOf(b)
      })
      return `每週${sorted.map(d => DOW_ZH[d]).join('')}`
    }
    case 'monthly_date':
      return `每月 ${config.day} 日`
    case 'monthly_weekday': {
      const weekLabel = config.week === -1 ? '末' : `${config.week}`
      return `每月第${weekLabel}個週${DOW_ZH[config.day ?? 1]}`
    }
    case 'yearly':
      return `每年 ${config.month}/${config.day}`
  }
}

// ─── iCal RRULE ───────────────────────────────────────────────────────────────

const DOW_ICAL = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

export function scheduleToRRule(type: ScheduleType, config: ScheduleConfig): string {
  switch (type) {
    case 'weekly': {
      const days = (config.days || []).map(d => DOW_ICAL[d]).join(',')
      return `RRULE:FREQ=WEEKLY;BYDAY=${days}`
    }
    case 'monthly_date':
      return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${config.day}`
    case 'monthly_weekday': {
      const prefix = config.week === -1 ? '-1' : `${config.week}`
      return `RRULE:FREQ=MONTHLY;BYDAY=${prefix}${DOW_ICAL[config.day ?? 1]}`
    }
    case 'yearly':
      return `RRULE:FREQ=YEARLY;BYMONTH=${config.month};BYMONTHDAY=${config.day}`
  }
}

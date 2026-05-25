import type { DateRange, RecurringTask } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

const pad = (value: number) => String(value).padStart(2, '0')

const toLocalDate = (date: string | Date): Date => {
  if (date instanceof Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }

  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const toISODate = (date: Date): string => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const getTodayISO = (): string => toISODate(new Date())

export const addDays = (date: string | Date, days: number): Date => {
  const base = toLocalDate(date)
  base.setDate(base.getDate() + days)
  return base
}

export const addDaysISO = (date: string | Date, days: number): string => {
  return toISODate(addDays(date, days))
}

export const getWeekRange = (date: string | Date): DateRange => {
  const base = toLocalDate(date)
  const day = base.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = addDays(base, mondayOffset)
  const dates = Array.from({ length: 7 }, (_, index) => addDaysISO(monday, index))

  return {
    start: dates[0],
    end: dates[6],
    dates,
  }
}

export const getNextWeekRange = (date: string | Date): DateRange => {
  return getWeekRange(addDays(date, 7))
}

export const isDateInRange = (date: string, start: string, end: string): boolean => {
  return date >= start && date <= end
}

export const getWeekId = (date: string | Date): string => {
  const local = toLocalDate(date)
  const target = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()))
  const dayNumber = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNumber + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3)
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * DAY_MS))

  return `${target.getUTCFullYear()}-W${pad(week)}`
}

export const formatReadableDate = (date: string, options?: Intl.DateTimeFormatOptions): string => {
  return toLocalDate(date).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    ...options,
  })
}

export const getMonthKey = (date: string | Date): string => {
  return toISODate(toLocalDate(date)).slice(0, 7)
}

export const formatMonthKey = (monthKey: string): string => {
  const [year, month] = monthKey.split('-').map(Number)

  return `${year}年${month}月`
}

export const getMonthDates = (monthKey: string): string[] => {
  const [year, month] = monthKey.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()

  return Array.from({ length: daysInMonth }, (_, index) =>
    toISODate(new Date(year, month - 1, index + 1)),
  )
}

export const formatWeekday = (date: string): string => {
  return toLocalDate(date).toLocaleDateString('zh-CN', { weekday: 'long' })
}

export const getMonthGridDates = (monthDate: Date): string[] => {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const lastOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  const start = getWeekRange(firstOfMonth).start
  const end = getWeekRange(lastOfMonth).end
  const dates: string[] = []
  let cursor = start

  while (cursor <= end) {
    dates.push(cursor)
    cursor = addDaysISO(cursor, 1)
  }

  return dates
}

export const calculateRecurringStreak = (
  task: Pick<RecurringTask, 'type' | 'completedKeys'>,
  referenceDate: string = getTodayISO(),
): number => {
  const completed = new Set(task.completedKeys)
  const currentKey = task.type === 'daily' ? referenceDate : getWeekId(referenceDate)
  let cursor = completed.has(currentKey)
    ? referenceDate
    : addDaysISO(referenceDate, task.type === 'daily' ? -1 : -7)
  let streak = 0

  for (let guard = 0; guard < 730; guard += 1) {
    const key = task.type === 'daily' ? cursor : getWeekId(cursor)

    if (!completed.has(key)) {
      break
    }

    streak += 1
    cursor = addDaysISO(cursor, task.type === 'daily' ? -1 : -7)
  }

  return streak
}

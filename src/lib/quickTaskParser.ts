import type { TaskDraft, TaskPriority, TaskTag } from '../types'
import { addDaysISO, formatReadableDate, getTodayISO, getWeekRange, toISODate } from './date'

type ParseConfidence = 'high' | 'medium' | 'low'

interface ParsedDate {
  date: string
  label: string
  matchedText: string
  index: number
  weight: number
}

interface ParsedTime {
  startTime?: string
  endTime?: string
  matchedText: string
  label: string
  index: number
}

export interface QuickTaskParseResult {
  source: string
  draft: TaskDraft
  confidence: ParseConfidence
  recognized: {
    date?: string
    dateLabel?: string
    startTime?: string
    endTime?: string
    timeLabel?: string
    noTimeLabel?: string
    tag?: TaskTag
    priority?: TaskPriority
  }
  messages: string[]
}

const CHINESE_DIGITS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
}

const WEEKDAY_INDEX: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 7,
  天: 7,
}

const NO_TIME_PATTERNS = [
  '无具体时间',
  '不定时间',
  '什么时候都行',
  '有空',
  '抽空',
  '今天内',
  '全天',
  '随时',
]

const TIME_PERIODS = ['凌晨', '清晨', '早晨', '早上', '上午', '中午', '午后', '下午', '傍晚', '晚上', '夜里', '深夜'] as const

type TimePeriod = (typeof TIME_PERIODS)[number]

const TIME_PERIOD_PATTERN = TIME_PERIODS.join('|')

const TIME_PERIOD_RANGES: Record<TimePeriod, { start: string; end: string; label: string }> = {
  凌晨: { start: '00:00', end: '06:00', label: '凌晨' },
  清晨: { start: '06:00', end: '08:00', label: '清晨' },
  早晨: { start: '06:00', end: '08:00', label: '早晨' },
  早上: { start: '08:00', end: '12:00', label: '早上' },
  上午: { start: '08:00', end: '12:00', label: '上午' },
  中午: { start: '12:00', end: '14:00', label: '中午' },
  午后: { start: '14:00', end: '18:00', label: '午后' },
  下午: { start: '12:00', end: '18:00', label: '下午' },
  傍晚: { start: '17:00', end: '19:00', label: '傍晚' },
  晚上: { start: '18:00', end: '23:59', label: '晚上' },
  夜里: { start: '20:00', end: '23:59', label: '夜里' },
  深夜: { start: '22:00', end: '23:59', label: '深夜' },
}

const COMPACT_DATE_PERIODS: Array<{ pattern: RegExp; offset: number; period: TimePeriod }> = [
  { pattern: /今早|今晨/g, offset: 0, period: '早上' },
  { pattern: /今晚|今夜/g, offset: 0, period: '晚上' },
  { pattern: /明早|明晨/g, offset: 1, period: '早上' },
  { pattern: /明晚|明夜/g, offset: 1, period: '晚上' },
  { pattern: /后晚|后天晚/g, offset: 2, period: '晚上' },
  { pattern: /大后晚|大后天晚/g, offset: 3, period: '晚上' },
]

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeInput = (value: string) =>
  value
    .replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10))
    .replace(/[：]/g, ':')
    .replace(/\s+/g, ' ')
    .trim()

const parseChineseNumber = (value: string): number | null => {
  if (/^\d+$/.test(value)) {
    return Number(value)
  }

  const normalized = value.replace(/两/g, '二')

  if (normalized === '十') {
    return 10
  }

  if (normalized.includes('十')) {
    const [tensText, onesText] = normalized.split('十')
    const tens = tensText ? CHINESE_DIGITS[tensText] : 1
    const ones = onesText ? CHINESE_DIGITS[onesText] : 0

    if (tens === undefined || ones === undefined) {
      return null
    }

    return tens * 10 + ones
  }

  return CHINESE_DIGITS[normalized] ?? null
}

const createValidDate = (year: number, month: number, day: number): Date | null => {
  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

const getFutureMonthDayISO = (month: number, day: number, todayISO: string): string | null => {
  const today = new Date()
  const thisYear = today.getFullYear()
  const current = createValidDate(thisYear, month, day)

  if (current && toISODate(current) >= todayISO) {
    return toISODate(current)
  }

  const nextYear = createValidDate(thisYear + 1, month, day)

  return nextYear ? toISODate(nextYear) : null
}

const getFutureDayOfMonthISO = (day: number, todayISO: string): string | null => {
  const today = new Date()

  for (let offset = 0; offset < 18; offset += 1) {
    const candidate = createValidDate(today.getFullYear(), today.getMonth() + 1 + offset, day)

    if (candidate && toISODate(candidate) >= todayISO) {
      return toISODate(candidate)
    }
  }

  return null
}

const getWeekdayDate = (weekday: number, modifier: string | undefined, todayISO: string): string => {
  const today = new Date()
  const currentWeekday = today.getDay() === 0 ? 7 : today.getDay()

  if (!modifier || modifier === '周' || modifier === '星期' || modifier === '礼拜') {
    const delta = weekday >= currentWeekday ? weekday - currentWeekday : weekday - currentWeekday + 7

    return addDaysISO(todayISO, delta)
  }

  const thisMonday = getWeekRange(todayISO).start
  const weekOffset = modifier.includes('下下') ? 14 : modifier.includes('下') ? 7 : 0

  return addDaysISO(thisMonday, weekOffset + weekday - 1)
}

const pushDateMatch = (
  matches: ParsedDate[],
  date: string | null,
  matchedText: string,
  index: number,
  weight: number,
) => {
  if (!date) {
    return
  }

  matches.push({
    date,
    label: formatReadableDate(date),
    matchedText,
    index,
    weight,
  })
}

const findDate = (text: string): ParsedDate | null => {
  const todayISO = getTodayISO()
  const matches: ParsedDate[] = []

  for (const match of text.matchAll(/((?:19|20)\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/g)) {
    const date = createValidDate(Number(match[1]), Number(match[2]), Number(match[3]))
    pushDateMatch(matches, date ? toISODate(date) : null, match[0], match.index ?? 0, 100)
  }

  for (const match of text.matchAll(/((?:19|20)\d{2})年\s*(\d{1,2})月\s*(\d{1,2})\s*(?:日|号)?/g)) {
    const date = createValidDate(Number(match[1]), Number(match[2]), Number(match[3]))
    pushDateMatch(matches, date ? toISODate(date) : null, match[0], match.index ?? 0, 100)
  }

  for (const match of text.matchAll(/(?<!\d)(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)?/g)) {
    pushDateMatch(
      matches,
      getFutureMonthDayISO(Number(match[1]), Number(match[2]), todayISO),
      match[0],
      match.index ?? 0,
      90,
    )
  }

  for (const match of text.matchAll(/(?<!\d)(\d{1,2})[/.](\d{1,2})(?!\d)/g)) {
    pushDateMatch(
      matches,
      getFutureMonthDayISO(Number(match[1]), Number(match[2]), todayISO),
      match[0],
      match.index ?? 0,
      82,
    )
  }

  for (const match of text.matchAll(/(大后天|后天|明天|明日|明儿|今天|今日|昨天|前天)/g)) {
    const offsets: Record<string, number> = {
      前天: -2,
      昨天: -1,
      今天: 0,
      今日: 0,
      明天: 1,
      明日: 1,
      明儿: 1,
      后天: 2,
      大后天: 3,
    }

    pushDateMatch(matches, addDaysISO(todayISO, offsets[match[1]]), match[0], match.index ?? 0, 80)
  }

  for (const shortcut of COMPACT_DATE_PERIODS) {
    for (const match of text.matchAll(shortcut.pattern)) {
      pushDateMatch(matches, addDaysISO(todayISO, shortcut.offset), match[0], match.index ?? 0, 79)
    }
  }

  for (const match of text.matchAll(/([零一二两三四五六七八九十\d]{1,3})\s*天后/g)) {
    const days = parseChineseNumber(match[1])
    pushDateMatch(matches, days === null ? null : addDaysISO(todayISO, days), match[0], match.index ?? 0, 76)
  }

  for (const match of text.matchAll(/([零一二两三四五六七八九十\d]{1,2})\s*(?:周|星期|礼拜)后/g)) {
    const weeks = parseChineseNumber(match[1])
    pushDateMatch(matches, weeks === null ? null : addDaysISO(todayISO, weeks * 7), match[0], match.index ?? 0, 76)
  }

  for (const match of text.matchAll(/(下下周|下周|本周|这周)([一二三四五六日天])/g)) {
    const weekday = WEEKDAY_INDEX[match[2]]
    pushDateMatch(matches, getWeekdayDate(weekday, match[1], todayISO), match[0], match.index ?? 0, 74)
  }

  for (const match of text.matchAll(/(下下个星期|下个星期|这个星期|本星期|这星期|星期|礼拜|周)([一二三四五六日天])/g)) {
    const weekday = WEEKDAY_INDEX[match[2]]
    pushDateMatch(matches, getWeekdayDate(weekday, match[1], todayISO), match[0], match.index ?? 0, 72)
  }

  for (const match of text.matchAll(/(?<![年月/.\-\d])([0-3]?\d|[一二两三四五六七八九十]{1,3})\s*(?:号|日)/g)) {
    const day = parseChineseNumber(match[1])

    if (day !== null && day >= 1 && day <= 31) {
      pushDateMatch(matches, getFutureDayOfMonthISO(day, todayISO), match[0], match.index ?? 0, 52)
    }
  }

  return (
    matches
      .sort((first, second) => second.weight - first.weight || first.index - second.index)[0] ?? null
  )
}

const getPeriod = (text: string): TimePeriod | undefined =>
  TIME_PERIODS.find((period) => text.includes(period))

const getCompactPeriod = (text: string): TimePeriod | undefined => {
  const matched = COMPACT_DATE_PERIODS.find((shortcut) => shortcut.pattern.test(text))
  COMPACT_DATE_PERIODS.forEach((shortcut) => {
    shortcut.pattern.lastIndex = 0
  })

  return matched?.period
}

const getTimeContextPeriod = (text: string, index: number): TimePeriod | undefined => {
  const before = text.slice(Math.max(0, index - 8), index)

  return getPeriod(before) ?? getCompactPeriod(before)
}

const applyPeriod = (hour: number, period?: TimePeriod): number => {
  if (!period) {
    return hour
  }

  if (
    period === '午后' ||
    period === '下午' ||
    period === '傍晚' ||
    period === '晚上' ||
    period === '夜里' ||
    period === '深夜'
  ) {
    return hour < 12 ? hour + 12 : hour
  }

  if (period === '中午') {
    return hour < 11 ? hour + 12 : hour
  }

  if (period === '凌晨') {
    return hour === 12 ? 0 : hour
  }

  return hour
}

const formatTime = (hour: number, minute: number) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

const parseTimePiece = (
  value: string,
  fallbackPeriod?: TimePeriod,
): { value: string; period?: TimePeriod } | null => {
  const period = getPeriod(value) ?? fallbackPeriod
  const clean = value.replace(new RegExp(TIME_PERIOD_PATTERN, 'g'), '').replace(/\s+/g, '')
  let hour: number | null = null
  let minute = 0

  const colonMatch = clean.match(/^(\d{1,2}|[零一二两三四五六七八九十]{1,3}):(\d{1,2})$/)
  const pointMatch = clean.match(/^(\d{1,2}|[零一二两三四五六七八九十]{1,3})点(?:(半)|(\d{1,2}|[零一二两三四五六七八九十]{1,3})分?)?$/)

  if (colonMatch) {
    hour = parseChineseNumber(colonMatch[1])
    minute = Number(colonMatch[2])
  } else if (pointMatch) {
    hour = parseChineseNumber(pointMatch[1])
    minute = pointMatch[2] ? 30 : pointMatch[3] ? parseChineseNumber(pointMatch[3]) ?? 0 : 0
  }

  if (hour === null || hour > 23 || minute > 59) {
    return null
  }

  return {
    value: formatTime(applyPeriod(hour, period), minute),
    period,
  }
}

const TIME_PIECE_PATTERN =
  `(?:(?:${TIME_PERIOD_PATTERN})\\s*)?(?:\\d{1,2}|[零一二两三四五六七八九十]{1,3})(?:(?::\\s*\\d{1,2})|(?:\\s*点\\s*(?:半|\\d{1,2}\\s*分?|[零一二两三四五六七八九十]{1,3}\\s*分?)?))`

const findTimePeriodRange = (text: string): ParsedTime | null => {
  const candidates: ParsedTime[] = []

  for (const shortcut of COMPACT_DATE_PERIODS) {
    for (const match of text.matchAll(shortcut.pattern)) {
      const range = TIME_PERIOD_RANGES[shortcut.period]

      candidates.push({
        startTime: range.start,
        endTime: range.end,
        matchedText: match[0],
        label: `${range.label} ${range.start}-${range.end}`,
        index: match.index ?? 0,
      })
    }
  }

  const periodPattern = new RegExp(TIME_PERIOD_PATTERN, 'g')

  for (const match of text.matchAll(periodPattern)) {
    const period = match[0] as TimePeriod
    const range = TIME_PERIOD_RANGES[period]

    candidates.push({
      startTime: range.start,
      endTime: range.end,
      matchedText: match[0],
      label: `${range.label} ${range.start}-${range.end}`,
      index: match.index ?? 0,
    })
  }

  return candidates.sort((first, second) => first.index - second.index)[0] ?? null
}

const findTime = (text: string): ParsedTime | null => {
  const rangePattern = new RegExp(`(${TIME_PIECE_PATTERN})\\s*(?:到|至|-|—|~|～)\\s*(${TIME_PIECE_PATTERN})`, 'g')

  for (const match of text.matchAll(rangePattern)) {
    const start = parseTimePiece(match[1], getTimeContextPeriod(text, match.index ?? 0))
    const end = start ? parseTimePiece(match[2], start.period) : null

    if (start && end) {
      return {
        startTime: start.value,
        endTime: end.value,
        matchedText: match[0],
        label: `${start.value}-${end.value}`,
        index: match.index ?? 0,
      }
    }
  }

  const singlePattern = new RegExp(TIME_PIECE_PATTERN, 'g')

  for (const match of text.matchAll(singlePattern)) {
    const start = parseTimePiece(match[0], getTimeContextPeriod(text, match.index ?? 0))

    if (start) {
      return {
        startTime: start.value,
        matchedText: match[0],
        label: start.value,
        index: match.index ?? 0,
      }
    }
  }

  return findTimePeriodRange(text)
}

const findNoTimeLabel = (text: string) => NO_TIME_PATTERNS.find((pattern) => text.includes(pattern))

const inferTag = (text: string, priority: TaskPriority): TaskTag => {
  if (priority === 'must' || /紧急|马上|立刻|立即|尽快|火急/.test(text)) {
    return 'urgent'
  }

  if (/工作|公司|会议|汇报|客户|项目|邮件|面试|报告|合同|方案/.test(text)) {
    return 'work'
  }

  if (/生活|买菜|购物|取快递|快递|吃饭|洗衣|打扫|缴费|家里|银行|办卡|电影|朋友|家人/.test(text)) {
    return 'life'
  }

  return 'other'
}

const inferPriority = (text: string): TaskPriority => {
  if (/紧急|马上|立刻|立即|现在就|尽快|必须今天|今天必须|火急/.test(text)) {
    return 'must'
  }

  if (/重要|一定要|别忘|记得|必须|优先|不要忘/.test(text)) {
    return 'important'
  }

  return 'normal'
}

const removeFragments = (source: string, fragments: Array<string | undefined>) =>
  fragments.reduce<string>((current, fragment) => {
    if (!fragment) {
      return current
    }

    return current.replace(new RegExp(escapeRegExp(fragment), 'g'), ' ')
  }, source)

const cleanTitle = (source: string, fragments: Array<string | undefined>): string => {
  let title = removeFragments(source, fragments)

  title = title
    .replace(/[，,。；;：:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  let previous = ''

  while (previous !== title) {
    previous = title
    title = title.replace(/^(提醒我|帮我记一下|帮我记下|帮我记|记得|安排一下|新增|添加|我要|我想|需要|请|麻烦|帮我)\s*/g, '').trim()
  }

  title = title
    .replace(/^(紧急|重要|必做|优先)\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return title || '待补充任务'
}

export const parseQuickTaskInput = (rawInput: string): QuickTaskParseResult => {
  const source = normalizeInput(rawInput)
  const parsedDate = findDate(source)
  const parsedTime = findTime(source)
  const noTimeLabel = parsedTime ? undefined : findNoTimeLabel(source)
  const priority = inferPriority(source)
  const tag = inferTag(source, priority)
  const title = cleanTitle(source, [
    parsedDate?.matchedText,
    parsedTime?.matchedText,
    noTimeLabel,
    ...NO_TIME_PATTERNS,
  ])
  const date = parsedDate?.date ?? getTodayISO()
  const noTime = !parsedTime
  const messages: string[] = []

  if (parsedDate) {
    messages.push(`日期已识别为 ${parsedDate.label}`)
  } else {
    messages.push('未识别到明确日期，已默认设为今天')
  }

  if (parsedTime?.startTime) {
    messages.push(`时间已识别为 ${parsedTime.label}`)
  } else if (noTimeLabel) {
    messages.push(`已识别为无具体时间`)
  } else {
    messages.push('未识别到具体时间，已保持无具体时间')
  }

  if (tag !== 'other') {
    messages.push(`标签建议为 ${tag === 'work' ? '工作' : tag === 'life' ? '生活' : '紧急'}`)
  }

  if (priority !== 'normal') {
    messages.push(`重要程度建议为 ${priority === 'must' ? '必做' : '重要'}`)
  }

  return {
    source,
    draft: {
      title,
      date,
      startTime: parsedTime?.startTime,
      endTime: parsedTime?.endTime,
      noTime,
      description: '',
      tag,
      priority,
      completed: false,
    },
    confidence: parsedDate && parsedTime ? 'high' : parsedDate || parsedTime ? 'medium' : 'low',
    recognized: {
      date,
      dateLabel: parsedDate?.label,
      startTime: parsedTime?.startTime,
      endTime: parsedTime?.endTime,
      timeLabel: parsedTime?.label,
      noTimeLabel,
      tag,
      priority,
    },
    messages,
  }
}

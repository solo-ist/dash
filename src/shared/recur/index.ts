import type { RecurFreq, RecurRule } from './types'

export type { RecurFreq, RecurRule } from './types'

// -- word tables (mirrors src/shared/quickadd/parse.ts conventions) --------

const WEEKDAY_FULL = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const WEEKDAY_ABBR = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const MONTH_FULL = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
]
const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** JS Date#getDay() (0=Sun..6=Sat) -> ISO weekday (1=Mon..7=Sun). */
function jsToIso(jsIdx: number): number {
  return jsIdx === 0 ? 7 : jsIdx
}

/** ISO weekday (1=Mon..7=Sun) -> JS Date#getDay() index (0=Sun..6=Sat). */
function isoToJs(iso: number): number {
  return iso === 7 ? 0 : iso
}

function isoWeekdayFromWord(word: string): number | null {
  const w = word.toLowerCase()
  let idx = WEEKDAY_FULL.indexOf(w)
  if (idx === -1) idx = WEEKDAY_ABBR.indexOf(w)
  return idx === -1 ? null : jsToIso(idx)
}

function monthIndexFromWord(word: string): number | null {
  const w = word.toLowerCase()
  let idx = MONTH_FULL.indexOf(w)
  if (idx === -1) idx = MONTH_ABBR.indexOf(w)
  return idx === -1 ? null : idx
}

function unitFreqFromWord(word: string): RecurFreq | null {
  const w = word.toLowerCase().replace(/s$/, '')
  if (w === 'hour' || w === 'day' || w === 'week' || w === 'month' || w === 'year') return w
  return null
}

function stripComma(tok: string): string {
  return tok.replace(/,$/, '')
}

function parseTimeWord(word: string): { hour: number; minute: number } | null {
  const w = word.toLowerCase()
  if (w === 'noon') return { hour: 12, minute: 0 }

  let m = /^(\d{1,2}):([0-5]\d)(am|pm)$/.exec(w)
  if (m) {
    let hour = parseInt(m[1], 10)
    const minute = parseInt(m[2], 10)
    if (hour < 1 || hour > 12) return null
    if (m[3] === 'pm' && hour !== 12) hour += 12
    if (m[3] === 'am' && hour === 12) hour = 0
    return { hour, minute }
  }

  m = /^(\d{1,2})(am|pm)$/.exec(w)
  if (m) {
    let hour = parseInt(m[1], 10)
    if (hour < 1 || hour > 12) return null
    if (m[2] === 'pm' && hour !== 12) hour += 12
    if (m[2] === 'am' && hour === 12) hour = 0
    return { hour, minute: 0 }
  }

  m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(w)
  if (m) return { hour: parseInt(m[1], 10), minute: parseInt(m[2], 10) }

  return null
}

function ordinalSuffix(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return 'th'
  switch (n % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}

function formatTime(at: { hour: number; minute: number }): string {
  const period = at.hour < 12 ? 'am' : 'pm'
  let h12 = at.hour % 12
  if (h12 === 0) h12 = 12
  if (at.minute === 0) return `${h12}${period}`
  return `${h12}:${String(at.minute).padStart(2, '0')}${period}`
}

// -- parseRecur --------------------------------------------------------

interface BodyResult {
  freq: RecurFreq
  interval: number
  byWeekday?: number[]
  byMonthDay?: number | 'last'
  byMonth?: number
  nthWeekday?: { nth: number; weekday: number }
  consumed: number
}

function parseBody(toks: string[]): BodyResult | null {
  const t0 = toks[0]
  const t1 = toks[1]
  if (t0 === undefined) return null

  if (t0 === 'weekday' || t0 === 'workday') {
    return { freq: 'week', interval: 1, byWeekday: [1, 2, 3, 4, 5], consumed: 1 }
  }

  if (t0 === 'last' && t1 === 'day') {
    return { freq: 'month', interval: 1, byMonthDay: 'last', consumed: 2 }
  }

  const ordinalMatch = /^(\d{1,2})(st|nd|rd|th)$/.exec(t0)
  if (ordinalMatch && t1 !== undefined) {
    const weekday = isoWeekdayFromWord(t1)
    if (weekday !== null) {
      const nth = parseInt(ordinalMatch[1], 10)
      return { freq: 'month', interval: 1, nthWeekday: { nth, weekday }, consumed: 2 }
    }
  }

  const monthIdx = monthIndexFromWord(t0)
  if (monthIdx !== null && t1 !== undefined && /^\d{1,2}$/.test(t1)) {
    const day = parseInt(t1, 10)
    if (day >= 1 && day <= 31) {
      return { freq: 'year', interval: 1, byMonth: monthIdx + 1, byMonthDay: day, consumed: 2 }
    }
  }

  if (/^\d+$/.test(t0) && t1 !== undefined) {
    const freq = unitFreqFromWord(t1)
    const interval = parseInt(t0, 10)
    if (freq && interval > 0) return { freq, interval, consumed: 2 }
  }

  if (isoWeekdayFromWord(stripComma(t0)) !== null) {
    const weekdays: number[] = []
    let j = 0
    for (;;) {
      const tok = toks[j]
      if (!tok) break
      const wIdx = isoWeekdayFromWord(stripComma(tok))
      if (wIdx === null) break
      weekdays.push(wIdx)
      const hadComma = /,$/.test(tok)
      j++
      if (!hadComma) break
    }
    if (weekdays.length > 0) return { freq: 'week', interval: 1, byWeekday: weekdays, consumed: j }
  }

  const freq = unitFreqFromWord(t0)
  if (freq) return { freq, interval: 1, consumed: 1 }

  return null
}

/**
 * Parses the canonical recur string emitted by the quick-add parser
 * (`src/shared/quickadd/parse.ts`, `findRecurrence`/`parseRecurBody`).
 * Returns null for anything that isn't a recurrence string (e.g. a one-shot
 * NL date like "next tuesday at noon").
 */
export function parseRecur(input: string): RecurRule | null {
  const trimmed = input.trim().toLowerCase()
  const prefixMatch = /^every(!)?\s+(.+)$/.exec(trimmed)
  if (!prefixMatch) return null
  const strict = prefixMatch[1] === '!'

  const toks = prefixMatch[2].split(/\s+/).filter(Boolean)
  const body = parseBody(toks)
  if (!body) return null

  let i = body.consumed
  let at: { hour: number; minute: number } | undefined
  let ends: string | undefined

  if (toks[i] === 'at') {
    const timeTok = toks[i + 1]
    const parsedTime = timeTok !== undefined ? parseTimeWord(timeTok) : null
    if (!parsedTime) return null
    at = parsedTime
    i += 2
  } else if (toks[i] !== undefined && toks[i] !== 'ending') {
    const bareTime = parseTimeWord(toks[i])
    if (bareTime) {
      at = bareTime
      i += 1
    }
  }

  if (toks[i] === 'ending') {
    const dateTok = toks[i + 1]
    if (!dateTok || !/^\d{4}-\d{2}-\d{2}$/.test(dateTok)) return null
    ends = dateTok
    i += 2
  }

  if (i !== toks.length) return null

  return {
    freq: body.freq,
    interval: body.interval,
    byWeekday: body.byWeekday,
    byMonthDay: body.byMonthDay,
    byMonth: body.byMonth,
    nthWeekday: body.nthWeekday,
    at,
    strict,
    ends
  }
}

// -- formatRecur ---------------------------------------------------------

function pluralUnit(freq: RecurFreq): string {
  return `${freq}s`
}

/** Serializes a RecurRule back to its canonical string; parseRecur(formatRecur(r)) round-trips. */
export function formatRecur(rule: RecurRule): string {
  const isWeekdayAlias =
    rule.freq === 'week' &&
    rule.interval === 1 &&
    !!rule.byWeekday &&
    rule.byWeekday.length === 5 &&
    [1, 2, 3, 4, 5].every((d) => rule.byWeekday!.includes(d))

  let body: string
  if (rule.freq === 'month' && rule.nthWeekday) {
    const weekdayWord = WEEKDAY_FULL[isoToJs(rule.nthWeekday.weekday)]
    body = `${rule.nthWeekday.nth}${ordinalSuffix(rule.nthWeekday.nth)} ${weekdayWord}`
  } else if (rule.freq === 'month' && rule.byMonthDay === 'last') {
    body = 'last day'
  } else if (
    rule.freq === 'year' &&
    rule.byMonth !== undefined &&
    rule.byMonthDay !== undefined &&
    rule.byMonthDay !== 'last'
  ) {
    body = `${MONTH_ABBR[rule.byMonth - 1]} ${rule.byMonthDay}`
  } else if (isWeekdayAlias) {
    body = 'weekday'
  } else if (rule.freq === 'week' && rule.byWeekday && rule.byWeekday.length > 0) {
    body = rule.byWeekday.map((w) => WEEKDAY_ABBR[isoToJs(w)]).join(', ')
  } else {
    body = rule.interval > 1 ? `${rule.interval} ${pluralUnit(rule.freq)}` : rule.freq
  }

  if (rule.at) body += ` at ${formatTime(rule.at)}`
  if (rule.ends) body += ` ending ${rule.ends}`

  return `every${rule.strict ? '!' : ''} ${body}`
}

// -- nextOccurrence --------------------------------------------------------

interface WallParts {
  y: number
  m: number
  d: number
  hour: number
  minute: number
  hasTime: boolean
}

function parseWall(s: string): WallParts {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):\d{2})?$/.exec(s)
  if (!m) throw new Error(`invalid wall-time value: ${s}`)
  const y = parseInt(m[1], 10)
  const month = parseInt(m[2], 10) - 1
  const d = parseInt(m[3], 10)
  if (m[4] !== undefined && m[5] !== undefined) {
    return { y, m: month, d, hour: parseInt(m[4], 10), minute: parseInt(m[5], 10), hasTime: true }
  }
  return { y, m: month, d, hour: 0, minute: 0, hasTime: false }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatWall(y: number, m: number, d: number, hasTime: boolean, hour: number, minute: number): string {
  const datePart = `${String(y).padStart(4, '0')}-${pad2(m + 1)}-${pad2(d)}`
  return hasTime ? `${datePart}T${pad2(hour)}:${pad2(minute)}:00` : datePart
}

function compositeKey(y: number, m: number, d: number, hour: number, minute: number): string {
  return formatWall(y, m, d, true, hour, minute)
}

function daysInMonth(y: number, m0: number): number {
  return new Date(y, m0 + 1, 0).getDate()
}

function nthWeekdayDay(y: number, m0: number, isoWeekday: number, nth: number): number | null {
  const jsWeekday = isoToJs(isoWeekday)
  const dim = daysInMonth(y, m0)
  let count = 0
  for (let day = 1; day <= dim; day++) {
    if (new Date(y, m0, day).getDay() === jsWeekday) {
      count++
      if (count === nth) return day
    }
  }
  return null
}

function addMonthsClamped(y: number, m0: number, d: number, n: number): { y: number; m: number; d: number } {
  const total = m0 + n
  const targetY = y + Math.floor(total / 12)
  const targetM = ((total % 12) + 12) % 12
  return { y: targetY, m: targetM, d: Math.min(d, daysInMonth(targetY, targetM)) }
}

function addYearsClamped(y: number, m0: number, d: number, n: number): { y: number; m: number; d: number } {
  const targetY = y + n
  return { y: targetY, m: m0, d: Math.min(d, daysInMonth(targetY, m0)) }
}

function nextWeekdayFromList(
  y: number,
  m0: number,
  d: number,
  byWeekday: number[],
  interval: number
): { y: number; m: number; d: number } {
  const sorted = [...byWeekday].sort((a, b) => a - b)
  const baseDate = new Date(y, m0, d)
  const baseIso = jsToIso(baseDate.getDay())

  for (const w of sorted) {
    if (w > baseIso) {
      const dt = new Date(y, m0, d)
      dt.setDate(dt.getDate() + (w - baseIso))
      return { y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate() }
    }
  }

  const monday = new Date(y, m0, d)
  monday.setDate(monday.getDate() - (baseIso - 1))
  monday.setDate(monday.getDate() + interval * 7)
  monday.setDate(monday.getDate() + (sorted[0] - 1))
  return { y: monday.getFullYear(), m: monday.getMonth(), d: monday.getDate() }
}

/** Searches forward month-by-month (stepping `interval` months at a time) for the first day, per `dayForMonth`, strictly after base. */
function findMonthlyAfter(
  base: WallParts,
  interval: number,
  dayForMonth: (y: number, m0: number) => number | null,
  at: { hour: number; minute: number } | undefined
): { y: number; m: number; d: number } | null {
  const baseHour = base.hasTime ? base.hour : 0
  const baseMinute = base.hasTime ? base.minute : 0
  const baseKey = compositeKey(base.y, base.m, base.d, baseHour, baseMinute)
  const hour = at?.hour ?? 0
  const minute = at?.minute ?? 0

  let y = base.y
  let m = base.m
  for (let iter = 0; iter < 1200; iter++) {
    const day = dayForMonth(y, m)
    if (day !== null) {
      const candidateKey = compositeKey(y, m, day, hour, minute)
      if (candidateKey > baseKey) return { y, m, d: day }
    }
    m += interval
    y += Math.floor(m / 12)
    m = ((m % 12) + 12) % 12
  }
  return null
}

function findYearlyAfter(
  base: WallParts,
  interval: number,
  month0: number,
  day: number,
  at: { hour: number; minute: number } | undefined
): { y: number; m: number; d: number } {
  const baseHour = base.hasTime ? base.hour : 0
  const baseMinute = base.hasTime ? base.minute : 0
  const baseKey = compositeKey(base.y, base.m, base.d, baseHour, baseMinute)
  const hour = at?.hour ?? 0
  const minute = at?.minute ?? 0

  let y = base.y
  for (let iter = 0; iter < 1200; iter++) {
    const clampedDay = Math.min(day, daysInMonth(y, month0))
    const candidateKey = compositeKey(y, month0, clampedDay, hour, minute)
    if (candidateKey > baseKey) return { y, m: month0, d: clampedDay }
    y += interval
  }
  throw new Error('nextOccurrence: yearly search exceeded bound')
}

/**
 * Computes the next occurrence strictly after `base`, over local wall-time
 * values only (never UTC instants). `base` and the result are date-only
 * (`YYYY-MM-DD`) or local datetime (`YYYY-MM-DDTHH:MM:00`) strings, matching
 * `src/shared/quickadd/parse.ts`'s `formatDate`. Returns null once `rule.ends`
 * (inclusive date bound) has been passed.
 */
export function nextOccurrence(rule: RecurRule, base: string): string | null {
  const parsed = parseWall(base)
  const hasTimeOut = !!rule.at || rule.freq === 'hour'
  let hour = rule.at?.hour ?? 0
  let minute = rule.at?.minute ?? 0
  let resultY: number
  let resultM: number
  let resultD: number

  switch (rule.freq) {
    case 'hour': {
      const baseHour = parsed.hasTime ? parsed.hour : 0
      const baseMinute = parsed.hasTime ? parsed.minute : 0
      const dt = new Date(parsed.y, parsed.m, parsed.d, baseHour, baseMinute)
      dt.setHours(dt.getHours() + rule.interval)
      resultY = dt.getFullYear()
      resultM = dt.getMonth()
      resultD = dt.getDate()
      hour = dt.getHours()
      minute = dt.getMinutes()
      break
    }
    case 'day': {
      const dt = new Date(parsed.y, parsed.m, parsed.d)
      dt.setDate(dt.getDate() + rule.interval)
      resultY = dt.getFullYear()
      resultM = dt.getMonth()
      resultD = dt.getDate()
      break
    }
    case 'week': {
      if (rule.byWeekday && rule.byWeekday.length > 0) {
        const next = nextWeekdayFromList(parsed.y, parsed.m, parsed.d, rule.byWeekday, rule.interval)
        resultY = next.y
        resultM = next.m
        resultD = next.d
      } else {
        const dt = new Date(parsed.y, parsed.m, parsed.d)
        dt.setDate(dt.getDate() + 7 * rule.interval)
        resultY = dt.getFullYear()
        resultM = dt.getMonth()
        resultD = dt.getDate()
      }
      break
    }
    case 'month': {
      if (rule.nthWeekday) {
        const nth = rule.nthWeekday
        const next = findMonthlyAfter(parsed, rule.interval, (y, m0) => nthWeekdayDay(y, m0, nth.weekday, nth.nth), rule.at)
        if (!next) return null
        resultY = next.y
        resultM = next.m
        resultD = next.d
      } else if (rule.byMonthDay === 'last') {
        const next = findMonthlyAfter(parsed, rule.interval, (y, m0) => daysInMonth(y, m0), rule.at)
        if (!next) return null
        resultY = next.y
        resultM = next.m
        resultD = next.d
      } else {
        const next = addMonthsClamped(parsed.y, parsed.m, parsed.d, rule.interval)
        resultY = next.y
        resultM = next.m
        resultD = next.d
      }
      break
    }
    case 'year': {
      if (rule.byMonth !== undefined && rule.byMonthDay !== undefined && rule.byMonthDay !== 'last') {
        const next = findYearlyAfter(parsed, rule.interval, rule.byMonth - 1, rule.byMonthDay, rule.at)
        resultY = next.y
        resultM = next.m
        resultD = next.d
      } else {
        const next = addYearsClamped(parsed.y, parsed.m, parsed.d, rule.interval)
        resultY = next.y
        resultM = next.m
        resultD = next.d
      }
      break
    }
    default: {
      const exhaustive: never = rule.freq
      throw new Error(`nextOccurrence: unsupported freq ${String(exhaustive)}`)
    }
  }

  const resultStr = formatWall(resultY, resultM, resultD, hasTimeOut, hour, minute)
  if (rule.ends && resultStr.slice(0, 10) > rule.ends) return null
  return resultStr
}

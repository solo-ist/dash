import { describe, it, expect } from 'vitest'
import { parseRecur, formatRecur, nextOccurrence } from './index'
import type { RecurRule } from './types'

describe('parseRecur — 12-case probe table (docs/research/mcp-ground-truth.md)', () => {
  it('"every day" -> daily, interval 1', () => {
    const expected: RecurRule = {
      freq: 'day',
      interval: 1,
      byWeekday: undefined,
      byMonthDay: undefined,
      byMonth: undefined,
      nthWeekday: undefined,
      at: undefined,
      strict: false,
      ends: undefined
    }
    expect(parseRecur('every day')).toEqual(expected)
  })

  it('"every workday at 9am" -> Mon-Fri weekday set with time', () => {
    expect(parseRecur('every workday at 9am')).toMatchObject({
      freq: 'week',
      interval: 1,
      byWeekday: [1, 2, 3, 4, 5],
      at: { hour: 9, minute: 0 },
      strict: false
    })
  })

  it('"every 3rd friday" -> nth-weekday-of-month', () => {
    expect(parseRecur('every 3rd friday')).toMatchObject({
      freq: 'month',
      interval: 1,
      nthWeekday: { nth: 3, weekday: 5 },
      strict: false
    })
  })

  it('"every! 2 weeks" -> strict interval', () => {
    expect(parseRecur('every! 2 weeks')).toMatchObject({
      freq: 'week',
      interval: 2,
      strict: true
    })
  })

  it('"every jan 15" -> yearly by month/day', () => {
    expect(parseRecur('every jan 15')).toMatchObject({
      freq: 'year',
      interval: 1,
      byMonth: 1,
      byMonthDay: 15,
      strict: false
    })
  })

  it('"every mon, wed, fri at 8:30" -> multi-day weekday list with time', () => {
    expect(parseRecur('every mon, wed, fri at 8:30')).toMatchObject({
      freq: 'week',
      interval: 1,
      byWeekday: [1, 3, 5],
      at: { hour: 8, minute: 30 },
      strict: false
    })
  })

  it('"every last day" -> last-day-of-month', () => {
    expect(parseRecur('every last day')).toMatchObject({
      freq: 'month',
      interval: 1,
      byMonthDay: 'last',
      strict: false
    })
  })

  it('"every 2 months" (start-anchor folded into first dueDate, not in string)', () => {
    expect(parseRecur('every 2 months')).toMatchObject({
      freq: 'month',
      interval: 2,
      strict: false
    })
    expect(parseRecur('every 2 months')?.byMonthDay).toBeUndefined()
    expect(parseRecur('every 2 months')?.nthWeekday).toBeUndefined()
  })

  it('"next tuesday at noon" -> not recurring, parseRecur returns null', () => {
    expect(parseRecur('next tuesday at noon')).toBeNull()
  })

  it('"every day 9am" (canonicalized "every morning", no "at") -> daily with bare time', () => {
    expect(parseRecur('every day 9am')).toMatchObject({
      freq: 'day',
      interval: 1,
      at: { hour: 9, minute: 0 },
      strict: false
    })
  })

  it('"every day ending 2026-09-30" (canonicalized "every day until sep 30")', () => {
    expect(parseRecur('every day ending 2026-09-30')).toMatchObject({
      freq: 'day',
      interval: 1,
      ends: '2026-09-30',
      strict: false
    })
  })

  it('"every 6 hours" -> sub-daily interval', () => {
    expect(parseRecur('every 6 hours')).toMatchObject({
      freq: 'hour',
      interval: 6,
      strict: false
    })
  })
})

describe('parseRecur — malformed / non-canonical input', () => {
  it('returns null for input without "every" prefix', () => {
    expect(parseRecur('day')).toBeNull()
  })

  it('returns null for garbage after a valid body', () => {
    expect(parseRecur('every day banana')).toBeNull()
  })

  it('returns null for empty body', () => {
    expect(parseRecur('every')).toBeNull()
    expect(parseRecur('every ')).toBeNull()
  })

  it('returns null for an unparseable unit', () => {
    expect(parseRecur('every fortnight')).toBeNull()
  })
})

describe('formatRecur / parseRecur round-trip', () => {
  const canonicalForms = [
    'every day',
    'every hour',
    'every week',
    'every month',
    'every year',
    'every 2 weeks',
    'every 6 hours',
    'every weekday',
    'every last day',
    'every 3rd friday',
    'every 1st monday',
    'every jan 15',
    'every mon, wed, fri',
    'every mon, wed, fri at 8:30',
    'every workday at 9am',
    'every! 2 weeks',
    'every day ending 2026-09-30',
    'every day 9am'
  ]

  it.each(canonicalForms)('round-trips "%s" through format -> parse', (canonical) => {
    const rule = parseRecur(canonical)
    expect(rule).not.toBeNull()
    const formatted = formatRecur(rule as RecurRule)
    const reparsed = parseRecur(formatted)
    expect(reparsed).toEqual(rule)
  })
})

describe('nextOccurrence — daily / interval anchoring', () => {
  it('advances a date-only base by `interval` days', () => {
    const rule = parseRecur('every day')!
    expect(nextOccurrence(rule, '2026-09-08')).toBe('2026-09-09')
  })

  it('applies `at` time even when the base is date-only', () => {
    const rule = parseRecur('every day 9am')!
    expect(nextOccurrence(rule, '2026-09-08')).toBe('2026-09-09T09:00:00')
  })

  it('drops time-of-day when the rule has no `at`, even from a datetime base', () => {
    const rule = parseRecur('every week')!
    expect(nextOccurrence(rule, '2026-09-08T14:30:00')).toBe('2026-09-15')
  })

  it('every 2 weeks steps by 14 days from the old due date', () => {
    const rule = parseRecur('every! 2 weeks')!
    expect(nextOccurrence(rule, '2026-09-08')).toBe('2026-09-22')
  })
})

describe('nextOccurrence — weekday lists', () => {
  it('finds the next listed weekday later in the same week', () => {
    const rule = parseRecur('every mon, wed, fri')!
    // 2026-02-02 is a Monday
    expect(nextOccurrence(rule, '2026-02-02')).toBe('2026-02-04')
  })

  it('wraps to next week (interval 1) once the list is exhausted', () => {
    const rule = parseRecur('every mon, wed, fri')!
    // 2026-02-06 is a Friday, the last listed day that week
    expect(nextOccurrence(rule, '2026-02-06')).toBe('2026-02-09')
  })

  it('wraps to the interval-th week once the list is exhausted (interval 2)', () => {
    const rule = parseRecur('every 2 weeks')!
    const listRule: RecurRule = { ...rule, byWeekday: [1, 3, 5] }
    expect(nextOccurrence(listRule, '2026-02-06')).toBe('2026-02-16')
  })

  it('every workday at 9am finds the next weekday', () => {
    const rule = parseRecur('every workday at 9am')!
    // 2026-02-06 is a Friday
    expect(nextOccurrence(rule, '2026-02-06')).toBe('2026-02-09T09:00:00')
  })

  it('every mon, wed, fri at 8:30 attaches the time to the resolved date', () => {
    const rule = parseRecur('every mon, wed, fri at 8:30')!
    expect(nextOccurrence(rule, '2026-02-02')).toBe('2026-02-04T08:30:00')
  })
})

describe('nextOccurrence — monthly forms', () => {
  it('"every last day" from mid-month resolves to this month\'s last day', () => {
    const rule = parseRecur('every last day')!
    expect(nextOccurrence(rule, '2026-01-15')).toBe('2026-01-31')
  })

  it('"every last day" from the last day itself rolls to next month', () => {
    const rule = parseRecur('every last day')!
    expect(nextOccurrence(rule, '2026-01-31')).toBe('2026-02-28')
  })

  it('"every 3rd friday" from earlier in the month resolves within-month', () => {
    const rule = parseRecur('every 3rd friday')!
    // 3rd Friday of Feb 2026 is Feb 20
    expect(nextOccurrence(rule, '2026-02-01')).toBe('2026-02-20')
  })

  it('nth-weekday rolls across a month boundary once already past this month\'s occurrence', () => {
    const rule = parseRecur('every 3rd friday')!
    // 3rd Friday of Feb 2026 (Feb 20) already passed -> roll to March's 3rd Friday (Mar 20)
    expect(nextOccurrence(rule, '2026-02-21')).toBe('2026-03-20')
  })

  it('4th-weekday rolls forward when the base IS that month\'s occurrence', () => {
    const rule = parseRecur('every 4th friday')!
    // Feb 2026 has exactly 4 Fridays; the 4th is Feb 27
    expect(nextOccurrence(rule, '2026-02-27')).toBe('2026-03-27')
  })

  it('plain monthly interval clamps day 31 into a shorter target month', () => {
    const rule = parseRecur('every month')!
    expect(nextOccurrence(rule, '2026-01-31')).toBe('2026-02-28')
  })

  it('"every 2 months" (start-anchor folded away) steps by 2 calendar months', () => {
    const rule = parseRecur('every 2 months')!
    expect(nextOccurrence(rule, '2026-01-15')).toBe('2026-03-15')
  })
})

describe('nextOccurrence — yearly forms', () => {
  it('"every jan 15" resolves later this year when not yet passed', () => {
    const rule = parseRecur('every jan 15')!
    expect(nextOccurrence(rule, '2026-01-01')).toBe('2026-01-15')
  })

  it('"every jan 15" rolls to next year once this year\'s date has passed', () => {
    const rule = parseRecur('every jan 15')!
    expect(nextOccurrence(rule, '2026-07-30')).toBe('2027-01-15')
  })

  it('plain yearly interval clamps Feb 29 into a non-leap target year', () => {
    const rule = parseRecur('every year')!
    expect(nextOccurrence(rule, '2024-02-29')).toBe('2025-02-28')
  })
})

describe('nextOccurrence — sub-daily (hour)', () => {
  it('"every 6 hours" always produces a datetime, from a date-only base', () => {
    const rule = parseRecur('every 6 hours')!
    expect(nextOccurrence(rule, '2026-09-08')).toBe('2026-09-08T06:00:00')
  })

  it('"every 6 hours" advances from a datetime base', () => {
    const rule = parseRecur('every 6 hours')!
    expect(nextOccurrence(rule, '2026-09-08T20:00:00')).toBe('2026-09-09T02:00:00')
  })
})

describe('nextOccurrence — ending bound expiry', () => {
  it('returns the occurrence when its date is exactly on the ends bound', () => {
    const rule = parseRecur('every day ending 2026-09-10')!
    expect(nextOccurrence(rule, '2026-09-09')).toBe('2026-09-10')
  })

  it('returns the occurrence when its date is before the ends bound', () => {
    const rule = parseRecur('every day ending 2026-09-30')!
    expect(nextOccurrence(rule, '2026-09-08')).toBe('2026-09-09')
  })

  it('returns null once the computed occurrence is after the ends bound', () => {
    const rule = parseRecur('every day ending 2026-09-10')!
    expect(nextOccurrence(rule, '2026-09-10')).toBeNull()
  })
})

describe('parseRecur — strict flag', () => {
  it('sets strict:false for plain "every"', () => {
    expect(parseRecur('every day')?.strict).toBe(false)
  })

  it('sets strict:true for "every!"', () => {
    expect(parseRecur('every! day')?.strict).toBe(true)
  })
})

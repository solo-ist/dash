export type RecurFreq = 'day' | 'week' | 'month' | 'year' | 'hour'

export interface RecurRule {
  freq: RecurFreq
  interval: number
  /** ISO weekday numbers, 1=Monday..7=Sunday (matches quickadd's jsToIso convention). */
  byWeekday?: number[]
  byMonthDay?: number | 'last'
  /** 1-12 */
  byMonth?: number
  /** weekday is ISO 1-7, same convention as byWeekday. */
  nthWeekday?: { nth: number; weekday: number }
  at?: { hour: number; minute: number }
  strict: boolean
  /** date-only YYYY-MM-DD end bound, inclusive. */
  ends?: string
}

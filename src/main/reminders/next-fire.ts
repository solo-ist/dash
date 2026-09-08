/**
 * Pure reminder fire-time computation — no electron import, no db import, no
 * Date.now() calls. Wall-time strings are converted to epoch ms only via
 * local calendar arithmetic (`new Date(y, m-1, d, hh, mm)`), never
 * `toISOString`/`Date.parse` (architecture.md §10, §8's wall-time rule
 * applies here too). `firedAt` is the one exception: it's a UTC instant
 * (like `updated_at`), so callers pass it already converted to epoch ms.
 */

export type ReminderKind = 'relative' | 'absolute'

/** When a task's due has no time-of-day, relative reminders anchor to this
 * local time — the single place this default is defined. */
export const DEFAULT_DUE_HOUR = 9
export const DEFAULT_DUE_MINUTE = 0

export interface ReminderCandidate {
  id: string
  taskId: string
  taskTitle: string
  kind: ReminderKind
  /** Relative reminders: minutes before the task's due datetime. */
  minuteOffset: number | null
  /** Absolute reminders: local wall-time 'YYYY-MM-DD HH:MM'. */
  at: string | null
  /** Epoch ms of the last time this reminder fired, or null if never. */
  firedAt: number | null
  /** Task's due_date column: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:00'. */
  taskDueDate: string | null
  taskDueHasTime: boolean
  taskCompleted: boolean
}

export interface ReminderFiring {
  reminderId: string
  taskId: string
  taskTitle: string
  fireAt: number
}

const ABSOLUTE_AT_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/
const DUE_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):\d{2})?$/

function wallToEpoch(y: number, m: number, d: number, hour: number, minute: number): number {
  return new Date(y, m - 1, d, hour, minute).getTime()
}

function parseAbsoluteAt(value: string): number | null {
  const match = ABSOLUTE_AT_RE.exec(value)
  if (!match) return null
  return wallToEpoch(Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]), Number(match[5]))
}

function dueEpoch(dueDate: string, hasTime: boolean): number | null {
  const match = DUE_DATE_RE.exec(dueDate)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (hasTime && match[4] !== undefined && match[5] !== undefined) {
    return wallToEpoch(y, m, d, Number(match[4]), Number(match[5]))
  }
  return wallToEpoch(y, m, d, DEFAULT_DUE_HOUR, DEFAULT_DUE_MINUTE)
}

function computeFireAt(candidate: ReminderCandidate): number | null {
  if (candidate.kind === 'absolute') {
    return candidate.at === null ? null : parseAbsoluteAt(candidate.at)
  }
  if (candidate.minuteOffset === null || candidate.taskDueDate === null) return null
  const due = dueEpoch(candidate.taskDueDate, candidate.taskDueHasTime)
  if (due === null) return null
  return due - candidate.minuteOffset * 60_000
}

function eligibleFirings(
  reminders: ReminderCandidate[],
  nowMs: number,
  includePast: boolean
): ReminderFiring[] {
  const firings: ReminderFiring[] = []
  for (const candidate of reminders) {
    if (candidate.taskCompleted) continue
    const fireAt = computeFireAt(candidate)
    if (fireAt === null) continue
    if (candidate.firedAt !== null && fireAt <= candidate.firedAt) continue
    if (!includePast && fireAt < nowMs) continue
    firings.push({
      reminderId: candidate.id,
      taskId: candidate.taskId,
      taskTitle: candidate.taskTitle,
      fireAt
    })
  }
  firings.sort((a, b) => a.fireAt - b.fireAt)
  return firings
}

/**
 * Reminders due right now or overdue (fireAt <= now), oldest first. Used by
 * the scheduler to catch up on firings missed while the app was asleep or
 * closed — NOT excluded by the "strictly in the past" rule that governs
 * `computeNextFire`, since these still need to notify once.
 */
export function computeDueFirings(reminders: ReminderCandidate[], nowMs: number): ReminderFiring[] {
  return eligibleFirings(reminders, nowMs, true).filter((firing) => firing.fireAt <= nowMs)
}

/**
 * The soonest still-future reminder(s) to arm a timer for (ties included).
 * Excludes: fires strictly in the past relative to `now`, reminders already
 * fired for this occurrence, and reminders on completed tasks.
 */
export function computeNextFire(reminders: ReminderCandidate[], nowMs: number): ReminderFiring[] {
  const future = eligibleFirings(reminders, nowMs, false)
  if (future.length === 0) return []
  const soonest = future[0].fireAt
  return future.filter((firing) => firing.fireAt === soonest)
}

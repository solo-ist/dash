import type Database from 'better-sqlite3'
import { computeDueFirings, computeNextFire, type ReminderCandidate, type ReminderKind } from './next-fire'

/** setTimeout's delay is a signed 32-bit int internally; longer waits must be
 * chunked or they fire immediately. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1

interface ReminderJoinRow {
  id: string
  taskId: string
  kind: string
  minuteOffset: number | null
  at: string | null
  firedAt: string | null
  taskTitle: string
  taskDueDate: string | null
  taskDueHasTime: number
  taskChecked: number
}

export interface SchedulerDeps {
  db: Database
  notify: (title: string, body: string) => void
  /** Injectable for tests; defaults to Date.now. */
  now?: () => number
  /** Injectable for tests; defaults to the global setTimeout. */
  setTimeoutFn?: (callback: () => void, delayMs: number) => unknown
  /** Injectable for tests; defaults to the global clearTimeout. */
  clearTimeoutFn?: (handle: unknown) => void
}

export interface ReminderScheduler {
  /** Clears any pending timer, catches up on missed firings, and arms one
   * setTimeout for the soonest upcoming reminder. */
  rearm: () => void
  /** Clears any pending timer without re-arming (app shutdown). */
  stop: () => void
}

export function createReminderScheduler(deps: SchedulerDeps): ReminderScheduler {
  const now = deps.now ?? (() => Date.now())
  const scheduleTimeout = deps.setTimeoutFn ?? ((callback, delayMs) => setTimeout(callback, delayMs))
  const cancelTimeout = deps.clearTimeoutFn ?? ((handle) => clearTimeout(handle as NodeJS.Timeout))

  let timer: unknown = null

  function clearTimer(): void {
    if (timer !== null) {
      cancelTimeout(timer)
      timer = null
    }
  }

  function loadCandidates(): ReminderCandidate[] {
    const rows = deps.db
      .prepare(
        `SELECT r.id as id, r.task_id as taskId, r.kind as kind,
                r.minute_offset as minuteOffset, r.at as at, r.fired_at as firedAt,
                t.content as taskTitle, t.due_date as taskDueDate,
                t.due_has_time as taskDueHasTime, t.checked as taskChecked
         FROM reminders r
         JOIN tasks t ON t.id = r.task_id
         WHERE r.deleted_at IS NULL AND t.deleted_at IS NULL`
      )
      .all() as ReminderJoinRow[]

    return rows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      taskTitle: row.taskTitle,
      kind: row.kind as ReminderKind,
      minuteOffset: row.minuteOffset,
      at: row.at,
      firedAt: row.firedAt === null ? null : new Date(row.firedAt).getTime(),
      taskDueDate: row.taskDueDate,
      taskDueHasTime: row.taskDueHasTime === 1,
      taskCompleted: row.taskChecked === 1
    }))
  }

  function markFired(reminderId: string, whenMs: number): void {
    deps.db
      .prepare('UPDATE reminders SET fired_at = ? WHERE id = ?')
      .run(new Date(whenMs).toISOString(), reminderId)
  }

  /** Schedules `onElapsed` after `delayMs`, chunking waits over setTimeout's cap. */
  function armDelay(delayMs: number, onElapsed: () => void): void {
    if (delayMs > MAX_TIMEOUT_MS) {
      timer = scheduleTimeout(() => armDelay(delayMs - MAX_TIMEOUT_MS, onElapsed), MAX_TIMEOUT_MS)
    } else {
      timer = scheduleTimeout(onElapsed, Math.max(0, delayMs))
    }
  }

  function rearm(): void {
    clearTimer()
    const nowMs = now()
    let candidates = loadCandidates()

    const due = computeDueFirings(candidates, nowMs)
    for (const firing of due) {
      deps.notify(firing.taskTitle, 'Reminder')
      markFired(firing.reminderId, nowMs)
    }
    if (due.length > 0) candidates = loadCandidates()

    const next = computeNextFire(candidates, nowMs)
    if (next.length === 0) return

    armDelay(next[0].fireAt - nowMs, rearm)
  }

  return { rearm, stop: clearTimer }
}

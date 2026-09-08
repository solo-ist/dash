import { describe, expect, it, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../db/open'
import { migrate } from '../db/migrate'
import { mutate } from '../mutate'
import { createReminderScheduler } from './scheduler'

const MAX_TIMEOUT_MS = 2 ** 31 - 1

interface PendingTimer {
  callback: () => void
  delayMs: number
}

function makeFakeTimers(): {
  setTimeoutFn: (callback: () => void, delayMs: number) => unknown
  clearTimeoutFn: (handle: unknown) => void
  pending: Map<number, PendingTimer>
  fireNext: () => void
} {
  let idCounter = 0
  const pending = new Map<number, PendingTimer>()
  return {
    setTimeoutFn: (callback, delayMs) => {
      const id = ++idCounter
      pending.set(id, { callback, delayMs })
      return id
    },
    clearTimeoutFn: (handle) => {
      pending.delete(handle as number)
    },
    pending,
    fireNext: () => {
      const [id, entry] = [...pending.entries()][0]
      pending.delete(id)
      entry.callback()
    }
  }
}

function makeClock(startMs: number): { now: () => number; advanceTo: (ms: number) => void } {
  let current = startMs
  return { now: () => current, advanceTo: (ms) => (current = ms) }
}

function setup(): { db: Database } {
  const db = openDatabase(':memory:')
  migrate(db)
  return { db }
}

describe('createReminderScheduler', () => {
  it('arms a timer for the soonest upcoming reminder', () => {
    const { db } = setup()
    const task = mutate(db, { type: 'task.add', content: 'Standup' }).tasks![0]
    mutate(db, { type: 'reminder.create', taskId: task.id, kind: 'absolute', at: '2026-01-01 12:00' })
    mutate(db, { type: 'reminder.create', taskId: task.id, kind: 'absolute', at: '2026-01-01 09:00' })

    const clock = makeClock(new Date(2026, 0, 1, 0, 0).getTime())
    const timers = makeFakeTimers()
    const notify = vi.fn()
    const scheduler = createReminderScheduler({
      db,
      notify,
      now: clock.now,
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn
    })

    scheduler.rearm()

    expect(notify).not.toHaveBeenCalled()
    expect(timers.pending.size).toBe(1)
    const armed = [...timers.pending.values()][0]
    expect(armed.delayMs).toBe(new Date(2026, 0, 1, 9, 0).getTime() - clock.now())
  })

  it('fires notify and marks the reminder fired for a due reminder, then re-arms for the next one', () => {
    const { db } = setup()
    const task = mutate(db, { type: 'task.add', content: 'Overdue reminder task' }).tasks![0]
    const due = mutate(db, {
      type: 'reminder.create',
      taskId: task.id,
      kind: 'absolute',
      at: '2026-01-01 08:00'
    }).reminders![0]
    mutate(db, { type: 'reminder.create', taskId: task.id, kind: 'absolute', at: '2026-01-01 10:00' })

    const clock = makeClock(new Date(2026, 0, 1, 9, 0).getTime())
    const timers = makeFakeTimers()
    const notify = vi.fn()
    const scheduler = createReminderScheduler({
      db,
      notify,
      now: clock.now,
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn
    })

    scheduler.rearm()

    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith('Overdue reminder task', expect.any(String))

    const raw = db.prepare('SELECT fired_at FROM reminders WHERE id = ?').get(due.id) as {
      fired_at: string | null
    }
    expect(raw.fired_at).toBeTruthy()

    // The 10:00 reminder is still upcoming -> a timer should be armed for it.
    expect(timers.pending.size).toBe(1)
    const armed = [...timers.pending.values()][0]
    expect(armed.delayMs).toBe(new Date(2026, 0, 1, 10, 0).getTime() - clock.now())
  })

  it('does not re-fire a reminder already marked fired', () => {
    const { db } = setup()
    const task = mutate(db, { type: 'task.add', content: 'Once' }).tasks![0]
    mutate(db, { type: 'reminder.create', taskId: task.id, kind: 'absolute', at: '2026-01-01 08:00' })

    const clock = makeClock(new Date(2026, 0, 1, 9, 0).getTime())
    const timers = makeFakeTimers()
    const notify = vi.fn()
    const scheduler = createReminderScheduler({
      db,
      notify,
      now: clock.now,
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn
    })

    scheduler.rearm()
    expect(notify).toHaveBeenCalledTimes(1)

    scheduler.rearm()
    expect(notify).toHaveBeenCalledTimes(1)
    expect(timers.pending.size).toBe(0)
  })

  it('fires when its armed timer elapses', () => {
    const { db } = setup()
    const task = mutate(db, { type: 'task.add', content: 'Later' }).tasks![0]
    mutate(db, { type: 'reminder.create', taskId: task.id, kind: 'absolute', at: '2026-01-01 09:00' })

    const clock = makeClock(new Date(2026, 0, 1, 8, 0).getTime())
    const timers = makeFakeTimers()
    const notify = vi.fn()
    const scheduler = createReminderScheduler({
      db,
      notify,
      now: clock.now,
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn
    })

    scheduler.rearm()
    expect(notify).not.toHaveBeenCalled()

    clock.advanceTo(new Date(2026, 0, 1, 9, 0).getTime())
    timers.fireNext()

    expect(notify).toHaveBeenCalledTimes(1)
    expect(timers.pending.size).toBe(0)
  })

  it('excludes reminders on completed tasks', () => {
    const { db } = setup()
    const task = mutate(db, { type: 'task.add', content: 'Done already' }).tasks![0]
    mutate(db, { type: 'reminder.create', taskId: task.id, kind: 'absolute', at: '2026-01-01 08:00' })
    mutate(db, { type: 'task.complete', id: task.id })

    const clock = makeClock(new Date(2026, 0, 1, 9, 0).getTime())
    const timers = makeFakeTimers()
    const notify = vi.fn()
    const scheduler = createReminderScheduler({
      db,
      notify,
      now: clock.now,
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn
    })

    scheduler.rearm()

    expect(notify).not.toHaveBeenCalled()
    expect(timers.pending.size).toBe(0)
  })

  it('chunks a delay longer than the setTimeout cap', () => {
    const { db } = setup()
    const task = mutate(db, { type: 'task.add', content: 'Far future' }).tasks![0]
    // ~30 days out: past the setTimeout cap (~24.85 days) by less than the cap
    // itself, so this exercises exactly one chunk-then-final-fire hop.
    mutate(db, { type: 'reminder.create', taskId: task.id, kind: 'absolute', at: '2026-01-31 00:00' })

    const clock = makeClock(new Date(2026, 0, 1, 0, 0).getTime())
    const timers = makeFakeTimers()
    const notify = vi.fn()
    const scheduler = createReminderScheduler({
      db,
      notify,
      now: clock.now,
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn
    })

    const totalDelay = new Date(2026, 0, 31, 0, 0).getTime() - clock.now()
    expect(totalDelay).toBeGreaterThan(MAX_TIMEOUT_MS)
    expect(totalDelay).toBeLessThan(2 * MAX_TIMEOUT_MS)

    scheduler.rearm()

    expect(timers.pending.size).toBe(1)
    const [firstId, firstEntry] = [...timers.pending.entries()][0]
    expect(firstEntry.delayMs).toBe(MAX_TIMEOUT_MS)

    timers.pending.delete(firstId)
    firstEntry.callback()

    expect(timers.pending.size).toBe(1)
    const secondEntry = [...timers.pending.values()][0]
    expect(secondEntry.delayMs).toBe(totalDelay - MAX_TIMEOUT_MS)
    expect(notify).not.toHaveBeenCalled()
  })

  it('stop() clears the pending timer without re-arming', () => {
    const { db } = setup()
    const task = mutate(db, { type: 'task.add', content: 'Standup' }).tasks![0]
    mutate(db, { type: 'reminder.create', taskId: task.id, kind: 'absolute', at: '2026-01-01 09:00' })

    const clock = makeClock(new Date(2026, 0, 1, 0, 0).getTime())
    const timers = makeFakeTimers()
    const scheduler = createReminderScheduler({
      db,
      notify: vi.fn(),
      now: clock.now,
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn
    })

    scheduler.rearm()
    expect(timers.pending.size).toBe(1)

    scheduler.stop()
    expect(timers.pending.size).toBe(0)
  })
})

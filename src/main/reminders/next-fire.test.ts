import { describe, expect, it } from 'vitest'
import { computeDueFirings, computeNextFire, type ReminderCandidate } from './next-fire'

function candidate(overrides: Partial<ReminderCandidate>): ReminderCandidate {
  return {
    id: 'r1',
    taskId: 't1',
    taskTitle: 'Task',
    kind: 'absolute',
    minuteOffset: null,
    at: null,
    firedAt: null,
    taskDueDate: null,
    taskDueHasTime: false,
    taskCompleted: false,
    ...overrides
  }
}

describe('computeNextFire', () => {
  it('returns [] for empty input', () => {
    expect(computeNextFire([], Date.UTC(2026, 0, 1))).toEqual([])
  })

  it('includes an absolute reminder whose time is after now', () => {
    const now = new Date(2026, 0, 1, 8, 0).getTime()
    const r = candidate({ id: 'abs-future', kind: 'absolute', at: '2026-01-01 09:00' })

    const result = computeNextFire([r], now)

    expect(result).toHaveLength(1)
    expect(result[0].reminderId).toBe('abs-future')
    expect(result[0].fireAt).toBe(new Date(2026, 0, 1, 9, 0).getTime())
  })

  it('excludes an absolute reminder whose time is strictly before now', () => {
    const now = new Date(2026, 0, 1, 10, 0).getTime()
    const r = candidate({ id: 'abs-past', kind: 'absolute', at: '2026-01-01 09:00' })

    expect(computeNextFire([r], now)).toEqual([])
  })

  it('computes a relative reminder against a due datetime with a time-of-day', () => {
    const now = new Date(2026, 0, 15, 0, 0).getTime()
    const r = candidate({
      id: 'rel-timed',
      kind: 'relative',
      minuteOffset: 30,
      taskDueDate: '2026-01-15T14:00:00',
      taskDueHasTime: true
    })

    const result = computeNextFire([r], now)

    expect(result).toHaveLength(1)
    expect(result[0].fireAt).toBe(new Date(2026, 0, 15, 13, 30).getTime())
  })

  it('anchors a relative reminder to 09:00 local when the due date has no time-of-day', () => {
    const now = new Date(2026, 0, 15, 0, 0).getTime()
    const r = candidate({
      id: 'rel-dateonly',
      kind: 'relative',
      minuteOffset: 60,
      taskDueDate: '2026-01-15',
      taskDueHasTime: false
    })

    const result = computeNextFire([r], now)

    expect(result).toHaveLength(1)
    // due defaults to 09:00 -> fires at 08:00
    expect(result[0].fireAt).toBe(new Date(2026, 0, 15, 8, 0).getTime())
  })

  it('excludes a relative reminder when the task has no due date', () => {
    const now = new Date(2026, 0, 15, 0, 0).getTime()
    const r = candidate({ kind: 'relative', minuteOffset: 30, taskDueDate: null })

    expect(computeNextFire([r], now)).toEqual([])
  })

  it('picks only the soonest reminder(s) among multiple upcoming candidates', () => {
    const now = new Date(2026, 0, 1, 0, 0).getTime()
    const soonest = candidate({ id: 'soonest', kind: 'absolute', at: '2026-01-01 09:00' })
    const later = candidate({ id: 'later', kind: 'absolute', at: '2026-01-01 12:00' })

    const result = computeNextFire([later, soonest], now)

    expect(result).toHaveLength(1)
    expect(result[0].reminderId).toBe('soonest')
  })

  it('returns all reminders tied for soonest', () => {
    const now = new Date(2026, 0, 1, 0, 0).getTime()
    const a = candidate({ id: 'a', kind: 'absolute', at: '2026-01-01 09:00' })
    const b = candidate({ id: 'b', kind: 'absolute', at: '2026-01-01 09:00' })

    const result = computeNextFire([a, b], now)

    expect(result.map((f) => f.reminderId).sort()).toEqual(['a', 'b'])
  })

  it('excludes a reminder already fired for this occurrence', () => {
    const now = new Date(2026, 0, 1, 8, 0).getTime()
    const fireAt = new Date(2026, 0, 1, 9, 0).getTime()
    const r = candidate({
      kind: 'absolute',
      at: '2026-01-01 09:00',
      firedAt: fireAt // fired exactly at its computed time
    })

    expect(computeNextFire([r], now)).toEqual([])
  })

  it('fires again when the underlying due date has advanced past the last fired time', () => {
    // Recurring task: reminder fired for the old due date, but the task's due
    // has since moved forward (task.complete recomputed it), so the relative
    // reminder's new fireAt is later than firedAt -> eligible again.
    const now = new Date(2026, 0, 1, 0, 0).getTime()
    const r = candidate({
      kind: 'relative',
      minuteOffset: 60,
      taskDueDate: '2026-02-01',
      taskDueHasTime: false,
      firedAt: new Date(2026, 0, 1, 8, 0).getTime()
    })

    const result = computeNextFire([r], now)
    expect(result).toHaveLength(1)
  })

  it('excludes reminders on completed tasks', () => {
    const now = new Date(2026, 0, 1, 8, 0).getTime()
    const r = candidate({ kind: 'absolute', at: '2026-01-01 09:00', taskCompleted: true })

    expect(computeNextFire([r], now)).toEqual([])
  })
})

describe('computeDueFirings', () => {
  it('returns [] for empty input', () => {
    expect(computeDueFirings([], Date.UTC(2026, 0, 1))).toEqual([])
  })

  it('includes fires at or before now (catch-up on missed firings)', () => {
    const now = new Date(2026, 0, 1, 10, 0).getTime()
    const r = candidate({ kind: 'absolute', at: '2026-01-01 09:00' })

    const result = computeDueFirings([r], now)

    expect(result).toHaveLength(1)
    expect(result[0].fireAt).toBe(new Date(2026, 0, 1, 9, 0).getTime())
  })

  it('excludes fires still in the future', () => {
    const now = new Date(2026, 0, 1, 8, 0).getTime()
    const r = candidate({ kind: 'absolute', at: '2026-01-01 09:00' })

    expect(computeDueFirings([r], now)).toEqual([])
  })

  it('excludes already-fired and completed-task reminders', () => {
    const now = new Date(2026, 0, 1, 10, 0).getTime()
    const fired = candidate({
      id: 'fired',
      kind: 'absolute',
      at: '2026-01-01 09:00',
      firedAt: new Date(2026, 0, 1, 9, 0).getTime()
    })
    const completed = candidate({
      id: 'completed',
      kind: 'absolute',
      at: '2026-01-01 09:00',
      taskCompleted: true
    })

    expect(computeDueFirings([fired, completed], now)).toEqual([])
  })

  it('sorts multiple due firings oldest first', () => {
    const now = new Date(2026, 0, 1, 12, 0).getTime()
    const later = candidate({ id: 'later', kind: 'absolute', at: '2026-01-01 11:00' })
    const earlier = candidate({ id: 'earlier', kind: 'absolute', at: '2026-01-01 09:00' })

    const result = computeDueFirings([later, earlier], now)

    expect(result.map((f) => f.reminderId)).toEqual(['earlier', 'later'])
  })
})

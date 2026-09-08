import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createReminderStore, selectRemindersForTask } from './reminderStore'
import type { ReminderRow } from '../../shared/types'
import type { DashApi } from '../../shared/api'

const createReminderRow = (overrides: Partial<ReminderRow> = {}): ReminderRow => ({
  id: 'test-reminder-id',
  task_id: 'task-1',
  kind: 'relative',
  minute_offset: 30,
  at: null,
  fired_at: null,
  updated_at: new Date().toISOString(),
  deleted_at: null,
  ...overrides
})

function makeApi(): { api: DashApi; query: ReturnType<typeof vi.fn>; mutate: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> } {
  const query = vi.fn()
  const mutate = vi.fn()
  const on = vi.fn(() => () => {})
  const api = { platform: 'test', query, mutate, on } as DashApi
  return { api, query, mutate, on }
}

describe('reminderStore', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('load populates reminders and sets loaded', async () => {
    const { api, query } = makeApi()
    query.mockResolvedValue([createReminderRow({ id: '1' }), createReminderRow({ id: '2' })])

    const store = createReminderStore(api)
    await store.getState().load()

    expect(store.getState().reminders).toHaveLength(2)
    expect(store.getState().loaded).toBe(true)
    expect(store.getState().error).toBeNull()
    expect(query).toHaveBeenCalledWith('reminders.list', {})
  })

  it('load sets error on failure', async () => {
    const { api, query } = makeApi()
    query.mockRejectedValue(new Error('Failed to load'))

    const store = createReminderStore(api)
    await store.getState().load()

    expect(store.getState().error).toBe('Failed to load')
    expect(store.getState().loaded).toBe(false)
  })

  it('subscribes to data:changed on creation', () => {
    const { api, on } = makeApi()
    createReminderStore(api)
    expect(on).toHaveBeenCalledWith('data:changed', expect.any(Function))
  })

  it('refreshes on data:changed when reminders changed', () => {
    const { api, query, on } = makeApi()
    query.mockResolvedValue([])
    createReminderStore(api)

    const handler = on.mock.calls[0][1] as (payload: { entities: string[] }) => void
    handler({ entities: ['reminders'] })

    expect(query).toHaveBeenCalledWith('reminders.list', {})
  })

  it('add appends the mutated reminder on success', async () => {
    const { api, mutate } = makeApi()
    const created = createReminderRow({ id: 'new-1' })
    mutate.mockResolvedValue({ reminders: [created] })

    const store = createReminderStore(api)
    await store.getState().add({ taskId: 'task-1', kind: 'relative', minuteOffset: 30 })

    expect(mutate).toHaveBeenCalledWith({ type: 'reminder.create', taskId: 'task-1', kind: 'relative', minuteOffset: 30 })
    expect(store.getState().reminders).toEqual([created])
  })

  it('update replaces the matching reminder with the mutated row', async () => {
    const { api, mutate } = makeApi()
    const existing = createReminderRow({ id: '1', minute_offset: 30 })
    const updated = createReminderRow({ id: '1', minute_offset: 60 })
    mutate.mockResolvedValue({ reminders: [updated] })

    const store = createReminderStore(api)
    store.setState({ reminders: [existing] })
    await store.getState().update('1', { minuteOffset: 60 })

    expect(mutate).toHaveBeenCalledWith({ type: 'reminder.update', id: '1', minuteOffset: 60 })
    expect(store.getState().reminders).toEqual([updated])
  })

  it('remove optimistically drops the reminder and rolls back on failure', async () => {
    const { api, mutate } = makeApi()
    const existing = createReminderRow({ id: '1' })
    mutate.mockRejectedValue(new Error('delete failed'))

    const store = createReminderStore(api)
    store.setState({ reminders: [existing] })
    await store.getState().remove('1')

    expect(store.getState().reminders).toEqual([existing])
    expect(store.getState().error).toBe('delete failed')
  })
})

describe('selectRemindersForTask', () => {
  it('returns only live reminders for the given task', () => {
    const reminders = [
      createReminderRow({ id: '1', task_id: 't1' }),
      createReminderRow({ id: '2', task_id: 't1', deleted_at: '2026-01-01T00:00:00.000Z' }),
      createReminderRow({ id: '3', task_id: 't2' })
    ]

    const result = selectRemindersForTask(reminders, 't1')
    expect(result.map((r) => r.id)).toEqual(['1'])
  })
})

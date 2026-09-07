import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLabelStore, selectLabelsForTask, selectSortedLabels } from './labelStore'
import type { LabelRow, TaskLabelRow } from '../../shared/types'
import type { DashApi } from '../../shared/api'

const createLabelRow = (overrides: Partial<LabelRow> = {}): LabelRow => ({
  id: 'test-label-id',
  name: 'Urgent',
  color: 'charcoal',
  label_order: 0,
  is_favorite: 0,
  updated_at: new Date().toISOString(),
  deleted_at: null,
  ...overrides
})

const createTaskLabelRow = (overrides: Partial<TaskLabelRow> = {}): TaskLabelRow => ({
  task_id: 'task-1',
  label_id: 'test-label-id',
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

describe('labelStore', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('load populates labels and taskLabels and sets loaded', async () => {
    const { api, query } = makeApi()
    query.mockImplementation((name: string) => {
      if (name === 'labels.list') return Promise.resolve([createLabelRow({ id: '1' }), createLabelRow({ id: '2' })])
      if (name === 'taskLabels.list') return Promise.resolve([createTaskLabelRow()])
      return Promise.resolve([])
    })

    const store = createLabelStore(api)
    await store.getState().load()

    expect(store.getState().labels).toHaveLength(2)
    expect(store.getState().taskLabels).toHaveLength(1)
    expect(store.getState().loaded).toBe(true)
    expect(store.getState().error).toBeNull()
    expect(query).toHaveBeenCalledWith('labels.list', {})
    expect(query).toHaveBeenCalledWith('taskLabels.list', {})
  })

  it('load sets error on failure', async () => {
    const { api, query } = makeApi()
    query.mockRejectedValue(new Error('Failed to load'))

    const store = createLabelStore(api)
    await store.getState().load()

    expect(store.getState().error).toBe('Failed to load')
    expect(store.getState().loaded).toBe(false)
  })

  it('subscribes to data:changed on creation', () => {
    const { api, on } = makeApi()
    createLabelStore(api)
    expect(on).toHaveBeenCalledWith('data:changed', expect.any(Function))
  })

  it('refreshes on data:changed when labels or taskLabels changed', () => {
    const { api, query, on } = makeApi()
    query.mockResolvedValue([])
    createLabelStore(api)

    const handler = on.mock.calls[0][1] as (payload: { entities: string[] }) => void
    handler({ entities: ['labels'] })

    expect(query).toHaveBeenCalledWith('labels.list', {})
  })

  it('add appends the mutated label on success', async () => {
    const { api, mutate } = makeApi()
    const created = createLabelRow({ id: 'new-1', name: 'Errand' })
    mutate.mockResolvedValue({ labels: [created] })

    const store = createLabelStore(api)
    await store.getState().add({ name: 'Errand' })

    expect(mutate).toHaveBeenCalledWith({ type: 'label.add', name: 'Errand' })
    expect(store.getState().labels).toEqual([created])
  })

  it('rename replaces the matching label with the mutated row', async () => {
    const { api, mutate } = makeApi()
    const existing = createLabelRow({ id: '1', name: 'Old' })
    const renamed = createLabelRow({ id: '1', name: 'New' })
    mutate.mockResolvedValue({ labels: [renamed] })

    const store = createLabelStore(api)
    store.setState({ labels: [existing] })
    await store.getState().rename('1', 'New')

    expect(mutate).toHaveBeenCalledWith({ type: 'label.update', id: '1', name: 'New' })
    expect(store.getState().labels).toEqual([renamed])
  })

  it('toggleFavorite flips is_favorite based on current state', async () => {
    const { api, mutate } = makeApi()
    const existing = createLabelRow({ id: '1', is_favorite: 0 })
    const favorited = createLabelRow({ id: '1', is_favorite: 1 })
    mutate.mockResolvedValue({ labels: [favorited] })

    const store = createLabelStore(api)
    store.setState({ labels: [existing] })
    await store.getState().toggleFavorite('1')

    expect(mutate).toHaveBeenCalledWith({ type: 'label.update', id: '1', isFavorite: true })
    expect(store.getState().labels).toEqual([favorited])
  })

  it('remove optimistically drops the label and its task_labels rows, and rolls back on failure', async () => {
    const { api, mutate } = makeApi()
    const existing = createLabelRow({ id: '1' })
    const link = createTaskLabelRow({ label_id: '1' })
    mutate.mockRejectedValue(new Error('delete failed'))

    const store = createLabelStore(api)
    store.setState({ labels: [existing], taskLabels: [link] })
    await store.getState().remove('1')

    expect(store.getState().labels).toEqual([existing])
    expect(store.getState().error).toBe('delete failed')
  })

  it('setTaskLabels replaces the task_labels rows for a task', async () => {
    const { api, mutate } = makeApi()
    const newLink = createTaskLabelRow({ task_id: 'task-1', label_id: 'label-2' })
    mutate.mockResolvedValue({ taskLabels: [newLink] })

    const store = createLabelStore(api)
    store.setState({ taskLabels: [createTaskLabelRow({ task_id: 'task-1', label_id: 'label-1' })] })
    await store.getState().setTaskLabels('task-1', ['label-2'])

    expect(mutate).toHaveBeenCalledWith({ type: 'task.setLabels', id: 'task-1', labelIds: ['label-2'] })
    expect(store.getState().taskLabels).toEqual([newLink])
  })
})

describe('selectLabelsForTask', () => {
  it('returns only live labels linked to the given task', () => {
    const labels = [createLabelRow({ id: 'l1', name: 'A' }), createLabelRow({ id: 'l2', name: 'B' })]
    const taskLabels = [
      createTaskLabelRow({ task_id: 't1', label_id: 'l1' }),
      createTaskLabelRow({ task_id: 't1', label_id: 'l2', deleted_at: '2026-01-01T00:00:00.000Z' }),
      createTaskLabelRow({ task_id: 't2', label_id: 'l1' })
    ]

    const result = selectLabelsForTask(labels, taskLabels, 't1')
    expect(result.map((l) => l.id)).toEqual(['l1'])
  })
})

describe('selectSortedLabels', () => {
  it('filters deleted labels and sorts by label_order then name', () => {
    const labels = [
      createLabelRow({ id: '1', name: 'B', label_order: 1 }),
      createLabelRow({ id: '2', name: 'A', label_order: 0 }),
      createLabelRow({ id: '3', name: 'Z', deleted_at: '2026-01-01T00:00:00.000Z' })
    ]

    const result = selectSortedLabels(labels)
    expect(result.map((l) => l.id)).toEqual(['2', '1'])
  })
})

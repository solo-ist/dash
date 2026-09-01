import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTaskStore, selectOpenTasks, selectAllOpenTasks } from './taskStore'
import type { TaskRow } from '../../shared/types'
import type { DashApi } from '../../shared/api'

// Helper to create mock TaskRow fixtures
const createTaskRow = (overrides: Partial<TaskRow> = {}): TaskRow => ({
  id: 'test-id',
  checked: 0,
  content: 'Test task',
  description: '',
  project_id: '',
  section_id: null,
  parent_id: null,
  priority: 4,
  due_date: null,
  due_has_time: 0,
  recur_string: null,
  recur_strict: 0,
  recur_ends: null,
  deadline_date: null,
  duration_min: null,
  task_order: 0,
  is_header: 0,
  completed_at: null,
  added_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  ...overrides
})

const makeApi = (): DashApi => ({
  platform: 'test',
  tasks: {
    list: vi.fn(),
    add: vi.fn(),
    complete: vi.fn(),
    uncomplete: vi.fn(),
    delete: vi.fn()
  },
  projects: {
    list: vi.fn()
  }
})

describe('taskStore', () => {
  beforeEach(() => {
    // Reset temp ID counter for each test
    vi.resetModules()
  })

  it('load populates tasks and sets loaded', async () => {
    const api = makeApi()
    vi.mocked(api.tasks.list).mockResolvedValue([createTaskRow({ id: '1' }), createTaskRow({ id: '2' })])

    const store = createTaskStore(api)
    await store.getState().load()

    expect(store.getState().tasks).toHaveLength(2)
    expect(store.getState().loaded).toBe(true)
    expect(store.getState().error).toBeNull()
    expect(api.tasks.list).toHaveBeenCalled()
  })

  it('load sets error on failure', async () => {
    const api = makeApi()
    vi.mocked(api.tasks.list).mockRejectedValue(new Error('Failed to load'))

    const store = createTaskStore(api)
    await store.getState().load()

    expect(store.getState().error).toBe('Failed to load')
    expect(store.getState().loaded).toBe(false)
  })

  it('add inserts an optimistic temp row immediately', async () => {
    const api = makeApi()
    vi.mocked(api.tasks.add).mockResolvedValue(createTaskRow({ id: 'real-id', content: 'New task' }))

    const store = createTaskStore(api)
    const pending = store.getState().add({
      content: 'New task'
    })

    // Immediately assert the temp row is there
    const state = store.getState()
    expect(state.tasks).toHaveLength(1)
    expect(state.tasks[0].id).toMatch(/^temp-\d+$/)
    expect(state.tasks[0].content).toBe('New task')
    expect(state.error).toBeNull()

    // Wait for async operation
    await pending
    
    // Verify the real task was inserted
    const finalState = store.getState()
    expect(finalState.tasks).toHaveLength(1)
    expect(finalState.tasks[0].id).toBe('real-id')
    expect(finalState.tasks[0].content).toBe('New task')
    expect(api.tasks.add).toHaveBeenCalled()
  })

  it('add replaces temp row with real row on success', async () => {
    const api = makeApi()
    vi.mocked(api.tasks.add).mockResolvedValue(createTaskRow({ id: 'real-id', content: 'Real task' }))

    const store = createTaskStore(api)
    await store.getState().add({
      content: 'New task'
    })

    const state = store.getState()
    expect(state.tasks).toHaveLength(1)
    expect(state.tasks[0].id).toBe('real-id')
    expect(state.tasks[0].content).toBe('Real task')
    expect(api.tasks.add).toHaveBeenCalled()
  })

  it('add rolls back to prior list and sets error on failure', async () => {
    const api = makeApi()
    vi.mocked(api.tasks.add).mockRejectedValue(new Error('Failed to add'))

    const store = createTaskStore(api)
    await store.getState().add({
      content: 'New task'
    })

    const state = store.getState()
    expect(state.tasks).toHaveLength(0)
    expect(state.error).toBe('Failed to add')
  })

  it('complete sets checked=1 optimistically and rolls back on reject', async () => {
    const initialTask = createTaskRow({ id: 'task-1', checked: 0 })
    const api = makeApi()
    vi.mocked(api.tasks.complete).mockRejectedValue(new Error('Failed to complete'))

    const store = createTaskStore(api)
    store.setState({ tasks: [initialTask] })

    await store.getState().complete('task-1')

    const state = store.getState()
    expect(state.tasks[0].checked).toBe(0) // Should be rolled back
    expect(state.error).toBe('Failed to complete')
  })

  it('complete updates task and removes optimistic flag on success', async () => {
    const initialTask = createTaskRow({ id: 'task-1', checked: 0 })
    const completedTask = createTaskRow({ 
      id: 'task-1', 
      checked: 1,
      completed_at: new Date().toISOString()
    })
    const api = makeApi()
    vi.mocked(api.tasks.complete).mockResolvedValue(completedTask)

    const store = createTaskStore(api)
    store.setState({ tasks: [initialTask] })

    await store.getState().complete('task-1')

    const state = store.getState()
    expect(state.tasks[0].checked).toBe(1)
    expect(state.tasks[0].completed_at).not.toBeNull()
    expect(api.tasks.complete).toHaveBeenCalled()
  })

  it('remove drops the row and restores it on reject', async () => {
    const initialTask = createTaskRow({ id: 'task-1' })
    const api = makeApi()
    vi.mocked(api.tasks.delete).mockRejectedValue(new Error('Failed to delete'))

    const store = createTaskStore(api)
    store.setState({ tasks: [initialTask] })

    await store.getState().remove('task-1')

    const state = store.getState()
    expect(state.tasks).toHaveLength(1) // Should be rolled back
    expect(state.error).toBe('Failed to delete')
  })

  it('remove removes task on success', async () => {
    const initialTask = createTaskRow({ id: 'task-1' })
    const api = makeApi()
    vi.mocked(api.tasks.delete).mockResolvedValue(createTaskRow({ id: 'task-1' }))

    const store = createTaskStore(api)
    store.setState({ tasks: [initialTask] })

    await store.getState().remove('task-1')

    const state = store.getState()
    expect(state.tasks).toHaveLength(0)
    expect(api.tasks.delete).toHaveBeenCalled()
  })

  it('selectOpenTasks filters checked/deleted/project and sorts by added_at', () => {
    const tasks: TaskRow[] = [
      createTaskRow({ id: '1', checked: 1, deleted_at: null, project_id: 'proj1' }), // completed
      createTaskRow({ id: '2', checked: 0, deleted_at: '2023-01-01', project_id: 'proj1' }), // deleted
      createTaskRow({ id: '3', checked: 0, deleted_at: null, project_id: 'proj2' }), // wrong project
      createTaskRow({ id: '4', checked: 0, deleted_at: null, project_id: 'proj1', added_at: '2023-01-01' }), // correct task 1
      createTaskRow({ id: '5', checked: 0, deleted_at: null, project_id: 'proj1', added_at: '2023-01-02' }) // correct task 2
    ]

    const result = selectOpenTasks(tasks, 'proj1')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('4') // sorted by added_at ascending
    expect(result[1].id).toBe('5')
  })

  it('selectAllOpenTasks filters checked/deleted and sorts by added_at', () => {
    const tasks: TaskRow[] = [
      createTaskRow({ id: '1', checked: 1, deleted_at: null }), // completed
      createTaskRow({ id: '2', checked: 0, deleted_at: '2023-01-01' }), // deleted
      createTaskRow({ id: '3', checked: 0, deleted_at: null, added_at: '2023-01-01' }), // correct task 1
      createTaskRow({ id: '4', checked: 0, deleted_at: null, added_at: '2023-01-02' }) // correct task 2
    ]

    const result = selectAllOpenTasks(tasks)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('3') // sorted by added_at ascending
    expect(result[1].id).toBe('4')
  })
})
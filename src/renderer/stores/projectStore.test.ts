import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createProjectStore, selectInbox, selectFavorites, selectRegularProjects } from './projectStore'
import type { ProjectRow } from '../../shared/types'
import type { DashApi } from '../../shared/api'

// Helper to create mock ProjectRow fixtures
const createProjectRow = (overrides: Partial<ProjectRow> = {}): ProjectRow => ({
  id: 'test-id',
  name: 'Test Project',
  description: '',
  color: 'blue',
  parent_id: null,
  is_inbox: 0,
  is_favorite: 0,
  view_style: 'list',
  child_order: 0,
  archived_at: null,
  updated_at: new Date().toISOString(),
  deleted_at: null,
  ...overrides
})

function makeApi(): { api: DashApi; query: ReturnType<typeof vi.fn> } {
  const query = vi.fn()
  const mutate = vi.fn()
  const on = vi.fn()
  const api = { platform: 'test', query, mutate, on } as DashApi
  return { api, query }
}

describe('projectStore', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('load populates projects and sets loaded', async () => {
    const { api, query } = makeApi()
    query.mockResolvedValue([createProjectRow({ id: '1' }), createProjectRow({ id: '2' })])

    const store = createProjectStore(api)
    await store.getState().load()

    expect(store.getState().projects).toHaveLength(2)
    expect(store.getState().loaded).toBe(true)
    expect(store.getState().error).toBeNull()
    expect(query).toHaveBeenCalledWith('projects.list', {})
  })

  it('load sets error on failure', async () => {
    const { api, query } = makeApi()
    query.mockRejectedValue(new Error('Failed to load'))

    const store = createProjectStore(api)
    await store.getState().load()

    expect(store.getState().error).toBe('Failed to load')
    expect(store.getState().loaded).toBe(false)
  })

  it('selectInbox returns the inbox project', () => {
    const projects: ProjectRow[] = [
      createProjectRow({ id: '1', is_inbox: 0 }),
      createProjectRow({ id: '2', is_inbox: 1 }), // inbox
      createProjectRow({ id: '3', is_inbox: 0 })
    ]

    const result = selectInbox(projects)
    expect(result?.id).toBe('2')
  })

  it('selectInbox returns undefined when no inbox exists', () => {
    const projects: ProjectRow[] = [
      createProjectRow({ id: '1', is_inbox: 0 }),
      createProjectRow({ id: '2', is_inbox: 0 })
    ]

    const result = selectInbox(projects)
    expect(result).toBeUndefined()
  })

  it('selectFavorites filters favorites excluding inbox and sorts by child_order then name', () => {
    const projects: ProjectRow[] = [
      createProjectRow({ id: '1', is_favorite: 0, is_inbox: 0, child_order: 1, name: 'B Project' }),
      createProjectRow({ id: '2', is_favorite: 1, is_inbox: 1, child_order: 0, name: 'A Project' }), // inbox, favorite
      createProjectRow({ id: '3', is_favorite: 1, is_inbox: 0, child_order: 0, name: 'C Project' }), // favorite
      createProjectRow({ id: '4', is_favorite: 1, is_inbox: 0, child_order: 0, name: 'A Project' }) // favorite
    ]

    const result = selectFavorites(projects)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('4') // sorted by child_order then name
    expect(result[1].id).toBe('3')
  })

  it('selectRegularProjects filters inbox and deleted projects and sorts by child_order then name', () => {
    const projects: ProjectRow[] = [
      createProjectRow({ id: '1', is_inbox: 1, deleted_at: null }), // inbox
      createProjectRow({ id: '2', is_inbox: 0, deleted_at: '2023-01-01' }), // deleted
      createProjectRow({ id: '3', is_inbox: 0, deleted_at: null, child_order: 1, name: 'B Project' }), // regular
      createProjectRow({ id: '4', is_inbox: 0, deleted_at: null, child_order: 0, name: 'A Project' }) // regular
    ]

    const result = selectRegularProjects(projects)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('4') // sorted by child_order then name
    expect(result[1].id).toBe('3')
  })
})
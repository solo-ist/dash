import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createProjectStore,
  selectInbox,
  selectFavorites,
  selectRegularProjects,
  selectArchivedProjects
} from './projectStore'
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

function makeApi(): { api: DashApi; query: ReturnType<typeof vi.fn>; mutate: ReturnType<typeof vi.fn> } {
  const query = vi.fn()
  const mutate = vi.fn()
  const on = vi.fn()
  const api = { platform: 'test', query, mutate, on } as DashApi
  return { api, query, mutate }
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

  it('selectRegularProjects excludes archived projects', () => {
    const projects: ProjectRow[] = [
      createProjectRow({ id: '1', archived_at: '2026-01-01T00:00:00.000Z' }),
      createProjectRow({ id: '2', archived_at: null })
    ]

    const result = selectRegularProjects(projects)
    expect(result.map((p) => p.id)).toEqual(['2'])
  })

  it('selectArchivedProjects returns only archived, non-deleted projects sorted by name', () => {
    const projects: ProjectRow[] = [
      createProjectRow({ id: '1', name: 'B', archived_at: '2026-01-01T00:00:00.000Z' }),
      createProjectRow({ id: '2', name: 'A', archived_at: '2026-01-02T00:00:00.000Z' }),
      createProjectRow({ id: '3', name: 'C', archived_at: null }),
      createProjectRow({ id: '4', is_inbox: 1, archived_at: '2026-01-01T00:00:00.000Z' })
    ]

    const result = selectArchivedProjects(projects)
    expect(result.map((p) => p.id)).toEqual(['2', '1'])
  })

  it('add appends the mutated project on success', async () => {
    const { api, mutate } = makeApi()
    const created = createProjectRow({ id: 'new-1', name: 'Groceries' })
    mutate.mockResolvedValue({ projects: [created] })

    const store = createProjectStore(api)
    await store.getState().add({ name: 'Groceries' })

    expect(mutate).toHaveBeenCalledWith({ type: 'project.add', name: 'Groceries' })
    expect(store.getState().projects).toEqual([created])
  })

  it('rename replaces the matching project with the mutated row', async () => {
    const { api, mutate } = makeApi()
    const existing = createProjectRow({ id: '1', name: 'Old' })
    const renamed = createProjectRow({ id: '1', name: 'New' })
    mutate.mockResolvedValue({ projects: [renamed] })

    const store = createProjectStore(api)
    store.setState({ projects: [existing] })
    await store.getState().rename('1', 'New')

    expect(mutate).toHaveBeenCalledWith({ type: 'project.update', id: '1', name: 'New' })
    expect(store.getState().projects).toEqual([renamed])
  })

  it('toggleFavorite flips is_favorite based on current state', async () => {
    const { api, mutate } = makeApi()
    const existing = createProjectRow({ id: '1', is_favorite: 0 })
    const favorited = createProjectRow({ id: '1', is_favorite: 1 })
    mutate.mockResolvedValue({ projects: [favorited] })

    const store = createProjectStore(api)
    store.setState({ projects: [existing] })
    await store.getState().toggleFavorite('1')

    expect(mutate).toHaveBeenCalledWith({ type: 'project.update', id: '1', isFavorite: true })
    expect(store.getState().projects).toEqual([favorited])
  })

  it('archive and unarchive update the project row from the mutate result', async () => {
    const { api, mutate } = makeApi()
    const existing = createProjectRow({ id: '1', archived_at: null })
    const archived = createProjectRow({ id: '1', archived_at: '2026-01-01T00:00:00.000Z' })
    mutate.mockResolvedValue({ projects: [archived] })

    const store = createProjectStore(api)
    store.setState({ projects: [existing] })
    await store.getState().archive('1')

    expect(mutate).toHaveBeenCalledWith({ type: 'project.archive', id: '1' })
    expect(store.getState().projects).toEqual([archived])

    const unarchived = createProjectRow({ id: '1', archived_at: null })
    mutate.mockResolvedValue({ projects: [unarchived] })
    await store.getState().unarchive('1')

    expect(mutate).toHaveBeenCalledWith({ type: 'project.unarchive', id: '1' })
    expect(store.getState().projects).toEqual([unarchived])
  })

  it('remove optimistically drops the project and rolls back on failure', async () => {
    const { api, mutate } = makeApi()
    const existing = createProjectRow({ id: '1' })
    mutate.mockRejectedValue(new Error('delete failed'))

    const store = createProjectStore(api)
    store.setState({ projects: [existing] })
    await store.getState().remove('1')

    expect(store.getState().projects).toEqual([existing])
    expect(store.getState().error).toBe('delete failed')
  })
})
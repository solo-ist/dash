import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSectionStore, selectSectionsForProject } from './sectionStore'
import type { SectionRow } from '../../shared/types'
import type { DashApi } from '../../shared/api'

const createSectionRow = (overrides: Partial<SectionRow> = {}): SectionRow => ({
  id: 'test-id',
  project_id: 'project-1',
  name: 'Test Section',
  section_order: 0,
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

describe('sectionStore', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('load populates sections and sets loaded', async () => {
    const { api, query } = makeApi()
    query.mockResolvedValue([createSectionRow({ id: '1' }), createSectionRow({ id: '2' })])

    const store = createSectionStore(api)
    await store.getState().load()

    expect(store.getState().sections).toHaveLength(2)
    expect(store.getState().loaded).toBe(true)
    expect(query).toHaveBeenCalledWith('sections.list', {})
  })

  it('load sets error on failure', async () => {
    const { api, query } = makeApi()
    query.mockRejectedValue(new Error('Failed to load'))

    const store = createSectionStore(api)
    await store.getState().load()

    expect(store.getState().error).toBe('Failed to load')
    expect(store.getState().loaded).toBe(false)
  })

  it('add appends the mutated section', async () => {
    const { api, mutate } = makeApi()
    const created = createSectionRow({ id: 'new-1', name: 'To triage' })
    mutate.mockResolvedValue({ sections: [created] })

    const store = createSectionStore(api)
    await store.getState().add({ projectId: 'project-1', name: 'To triage' })

    expect(mutate).toHaveBeenCalledWith({
      type: 'section.add',
      projectId: 'project-1',
      name: 'To triage'
    })
    expect(store.getState().sections).toEqual([created])
  })

  it('rename replaces the matching section', async () => {
    const { api, mutate } = makeApi()
    const existing = createSectionRow({ id: '1', name: 'Old' })
    const renamed = createSectionRow({ id: '1', name: 'New' })
    mutate.mockResolvedValue({ sections: [renamed] })

    const store = createSectionStore(api)
    store.setState({ sections: [existing] })
    await store.getState().rename('1', 'New')

    expect(store.getState().sections).toEqual([renamed])
  })

  it('archive and unarchive update the section row', async () => {
    const { api, mutate } = makeApi()
    const existing = createSectionRow({ id: '1', archived_at: null })
    const archived = createSectionRow({ id: '1', archived_at: '2026-01-01T00:00:00.000Z' })
    mutate.mockResolvedValue({ sections: [archived] })

    const store = createSectionStore(api)
    store.setState({ sections: [existing] })
    await store.getState().archive('1')

    expect(store.getState().sections).toEqual([archived])
  })

  it('remove optimistically drops the section and rolls back on failure', async () => {
    const { api, mutate } = makeApi()
    const existing = createSectionRow({ id: '1' })
    mutate.mockRejectedValue(new Error('delete failed'))

    const store = createSectionStore(api)
    store.setState({ sections: [existing] })
    await store.getState().remove('1')

    expect(store.getState().sections).toEqual([existing])
    expect(store.getState().error).toBe('delete failed')
  })

  it('selectSectionsForProject filters by project, excludes deleted/archived, sorts by order', () => {
    const sections: SectionRow[] = [
      createSectionRow({ id: '1', project_id: 'p1', section_order: 1 }),
      createSectionRow({ id: '2', project_id: 'p1', section_order: 0 }),
      createSectionRow({ id: '3', project_id: 'p2', section_order: 0 }),
      createSectionRow({ id: '4', project_id: 'p1', deleted_at: '2026-01-01T00:00:00.000Z' }),
      createSectionRow({ id: '5', project_id: 'p1', archived_at: '2026-01-01T00:00:00.000Z' })
    ]

    const result = selectSectionsForProject(sections, 'p1')
    expect(result.map((s) => s.id)).toEqual(['2', '1'])
  })
})

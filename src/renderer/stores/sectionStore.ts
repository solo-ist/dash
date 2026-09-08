import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import type { DashApi } from '../../shared/api'
import type { SectionRow } from '../../shared/types'

export type SectionStore = UseBoundStore<StoreApi<SectionState>>

export interface SectionAddInput {
  projectId: string
  name: string
}

function requireSection(result: { sections?: SectionRow[] }): SectionRow {
  const section = result.sections?.[0]
  if (!section) throw new Error('mutate did not return a section')
  return section
}

export interface SectionState {
  sections: SectionRow[]
  loaded: boolean
  error: string | null
  load: () => Promise<void>
  add: (input: SectionAddInput) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  archive: (id: string) => Promise<void>
  unarchive: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function createSectionStore(api: DashApi): SectionStore {
  const store = create<SectionState>()((set, get) => ({
    sections: [],
    loaded: false,
    error: null,
    load: async () => {
      try {
        const sections = await api.query('sections.list', {})
        set({ sections, loaded: true, error: null })
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    },
    add: async (input: SectionAddInput) => {
      try {
        const result = await api.mutate({ type: 'section.add', ...input })
        const section = requireSection(result)
        set((state) => ({ sections: [...state.sections, section], error: null }))
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    },
    rename: async (id: string, name: string) => {
      try {
        const result = await api.mutate({ type: 'section.update', id, name })
        const section = requireSection(result)
        set((state) => ({
          sections: state.sections.map((s) => (s.id === id ? section : s)),
          error: null
        }))
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    },
    archive: async (id: string) => {
      try {
        const result = await api.mutate({ type: 'section.archive', id })
        const section = requireSection(result)
        set((state) => ({
          sections: state.sections.map((s) => (s.id === id ? section : s)),
          error: null
        }))
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    },
    unarchive: async (id: string) => {
      try {
        const result = await api.mutate({ type: 'section.unarchive', id })
        const section = requireSection(result)
        set((state) => ({
          sections: state.sections.map((s) => (s.id === id ? section : s)),
          error: null
        }))
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    },
    remove: async (id: string) => {
      const prevState = get()
      const sectionToRemove = prevState.sections.find((s) => s.id === id)
      if (!sectionToRemove) return

      set((state) => ({ sections: state.sections.filter((s) => s.id !== id), error: null }))

      try {
        await api.mutate({ type: 'section.delete', id })
      } catch (err) {
        set((state) => ({
          sections: [...state.sections, sectionToRemove],
          error: err instanceof Error ? err.message : String(err)
        }))
      }
    }
  }))

  // Reconcile on main-process broadcasts (same pattern as labelStore) so
  // mutations this store didn't initiate still render.
  api.on('data:changed', (payload) => {
    if (payload.entities.includes('sections')) {
      void store.getState().load()
    }
  })

  return store
}

export function selectSectionsForProject(sections: SectionRow[], projectId: string): SectionRow[] {
  return sections
    .filter((s) => s.project_id === projectId && s.deleted_at === null && s.archived_at === null)
    .sort((a, b) => a.section_order - b.section_order)
}

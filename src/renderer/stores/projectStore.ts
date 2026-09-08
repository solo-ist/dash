import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import type { DashApi } from '../../shared/api'
import type { ProjectRow } from '../../shared/types'

export type ProjectStore = UseBoundStore<StoreApi<ProjectState>>

export interface ProjectAddInput {
  name: string
  color?: string
  isFavorite?: boolean
}

function requireProject(result: { projects?: ProjectRow[] }): ProjectRow {
  const project = result.projects?.[0]
  if (!project) throw new Error('mutate did not return a project')
  return project
}

export interface ProjectState {
  projects: ProjectRow[]
  loaded: boolean
  error: string | null
  load: () => Promise<void>
  add: (input: ProjectAddInput) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  archive: (id: string) => Promise<void>
  unarchive: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function createProjectStore(api: DashApi): ProjectStore {
  const store = create<ProjectState>()((set, get) => ({
    projects: [],
    loaded: false,
    error: null,
    load: async () => {
      try {
        const projects = await api.query('projects.list', {})
        set({ projects, loaded: true, error: null })
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    },
    add: async (input: ProjectAddInput) => {
      try {
        const result = await api.mutate({ type: 'project.add', ...input })
        const project = requireProject(result)
        set((state) => ({ projects: [...state.projects, project], error: null }))
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    },
    rename: async (id: string, name: string) => {
      try {
        const result = await api.mutate({ type: 'project.update', id, name })
        const project = requireProject(result)
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? project : p)),
          error: null
        }))
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    },
    toggleFavorite: async (id: string) => {
      const current = get().projects.find((p) => p.id === id)
      if (!current) return
      try {
        const result = await api.mutate({
          type: 'project.update',
          id,
          isFavorite: current.is_favorite !== 1
        })
        const project = requireProject(result)
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? project : p)),
          error: null
        }))
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    },
    archive: async (id: string) => {
      try {
        const result = await api.mutate({ type: 'project.archive', id })
        const project = requireProject(result)
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? project : p)),
          error: null
        }))
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    },
    unarchive: async (id: string) => {
      try {
        const result = await api.mutate({ type: 'project.unarchive', id })
        const project = requireProject(result)
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? project : p)),
          error: null
        }))
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    },
    remove: async (id: string) => {
      const prevState = get()
      const projectToRemove = prevState.projects.find((p) => p.id === id)
      if (!projectToRemove) return

      set((state) => ({ projects: state.projects.filter((p) => p.id !== id), error: null }))

      try {
        await api.mutate({ type: 'project.delete', id })
      } catch (err) {
        set((state) => ({
          projects: [...state.projects, projectToRemove],
          error: err instanceof Error ? err.message : String(err)
        }))
      }
    }
  }))

  // Reconcile on main-process broadcasts (same pattern as labelStore) so
  // mutations this store didn't initiate still render.
  api.on('data:changed', (payload) => {
    if (payload.entities.includes('projects')) {
      void store.getState().load()
    }
  })

  return store
}

export function selectInbox(projects: ProjectRow[]): ProjectRow | undefined {
  return projects.find(project => project.is_inbox === 1)
}

export function selectFavorites(projects: ProjectRow[]): ProjectRow[] {
  return projects
    .filter(project => project.is_favorite === 1 && project.is_inbox !== 1 && project.archived_at === null)
    .sort((a, b) => {
      if (a.child_order !== b.child_order) {
        return a.child_order - b.child_order
      }
      return a.name.localeCompare(b.name)
    })
}

export function selectRegularProjects(projects: ProjectRow[]): ProjectRow[] {
  return projects
    .filter(project => project.is_inbox !== 1 && project.deleted_at === null && project.archived_at === null)
    .sort((a, b) => {
      if (a.child_order !== b.child_order) {
        return a.child_order - b.child_order
      }
      return a.name.localeCompare(b.name)
    })
}

export function selectArchivedProjects(projects: ProjectRow[]): ProjectRow[] {
  return projects
    .filter(project => project.is_inbox !== 1 && project.deleted_at === null && project.archived_at !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}
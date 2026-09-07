import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import type { DashApi } from '../../shared/api'
import type { ProjectRow } from '../../shared/types'

export type ProjectStore = UseBoundStore<StoreApi<ProjectState>>

export interface ProjectState {
  projects: ProjectRow[]
  loaded: boolean
  error: string | null
  load: () => Promise<void>
}

export function createProjectStore(api: DashApi): ProjectStore {
  return create<ProjectState>()((set) => ({
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
    }
  }))
}

export function selectInbox(projects: ProjectRow[]): ProjectRow | undefined {
  return projects.find(project => project.is_inbox === 1)
}

export function selectFavorites(projects: ProjectRow[]): ProjectRow[] {
  return projects
    .filter(project => project.is_favorite === 1 && project.is_inbox !== 1)
    .sort((a, b) => {
      if (a.child_order !== b.child_order) {
        return a.child_order - b.child_order
      }
      return a.name.localeCompare(b.name)
    })
}

export function selectRegularProjects(projects: ProjectRow[]): ProjectRow[] {
  return projects
    .filter(project => project.is_inbox !== 1 && project.deleted_at === null)
    .sort((a, b) => {
      if (a.child_order !== b.child_order) {
        return a.child_order - b.child_order
      }
      return a.name.localeCompare(b.name)
    })
}
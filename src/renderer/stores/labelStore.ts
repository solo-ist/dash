import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import type { DashApi } from '../../shared/api'
import type { LabelRow, TaskLabelRow } from '../../shared/types'

export type LabelStore = UseBoundStore<StoreApi<LabelState>>

export interface LabelAddInput {
  name: string
  color?: string
  isFavorite?: boolean
}

function requireLabel(result: { labels?: LabelRow[] }): LabelRow {
  const label = result.labels?.[0]
  if (!label) throw new Error('mutate did not return a label')
  return label
}

export interface LabelState {
  labels: LabelRow[]
  taskLabels: TaskLabelRow[]
  loaded: boolean
  error: string | null
  load: () => Promise<void>
  add: (input: LabelAddInput) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  setTaskLabels: (taskId: string, labelIds: string[]) => Promise<void>
}

export function createLabelStore(api: DashApi): LabelStore {
  const store = create<LabelState>()((set, get) => ({
    labels: [],
    taskLabels: [],
    loaded: false,
    error: null,
    load: async () => {
      try {
        const [labels, taskLabels] = await Promise.all([
          api.query('labels.list', {}),
          api.query('taskLabels.list', {})
        ])
        set({ labels, taskLabels, loaded: true, error: null })
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    },
    add: async (input: LabelAddInput) => {
      try {
        const result = await api.mutate({ type: 'label.add', ...input })
        const label = requireLabel(result)
        set((state) => ({ labels: [...state.labels, label], error: null }))
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    },
    rename: async (id: string, name: string) => {
      try {
        const result = await api.mutate({ type: 'label.update', id, name })
        const label = requireLabel(result)
        set((state) => ({
          labels: state.labels.map((l) => (l.id === id ? label : l)),
          error: null
        }))
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    },
    toggleFavorite: async (id: string) => {
      const current = get().labels.find((l) => l.id === id)
      if (!current) return
      try {
        const result = await api.mutate({
          type: 'label.update',
          id,
          isFavorite: current.is_favorite !== 1
        })
        const label = requireLabel(result)
        set((state) => ({
          labels: state.labels.map((l) => (l.id === id ? label : l)),
          error: null
        }))
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    },
    remove: async (id: string) => {
      const prevState = get()
      const labelToRemove = prevState.labels.find((l) => l.id === id)
      if (!labelToRemove) return
      const prevTaskLabels = prevState.taskLabels

      set((state) => ({
        labels: state.labels.filter((l) => l.id !== id),
        taskLabels: state.taskLabels.filter((tl) => tl.label_id !== id),
        error: null
      }))

      try {
        await api.mutate({ type: 'label.delete', id })
      } catch (err) {
        set({
          labels: [...get().labels, labelToRemove],
          taskLabels: prevTaskLabels,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    },
    setTaskLabels: async (taskId: string, labelIds: string[]) => {
      const prevTaskLabels = get().taskLabels
      try {
        const result = await api.mutate({ type: 'task.setLabels', id: taskId, labelIds })
        const updated = result.taskLabels ?? []
        set((state) => ({
          taskLabels: [
            ...state.taskLabels.filter((tl) => tl.task_id !== taskId),
            ...updated
          ],
          error: null
        }))
      } catch (err) {
        set({ taskLabels: prevTaskLabels, error: err instanceof Error ? err.message : String(err) })
      }
    }
  }))

  api.on('data:changed', (payload) => {
    if (payload.entities.includes('labels') || payload.entities.includes('taskLabels')) {
      void store.getState().load()
    }
  })

  return store
}

export function selectLabelsForTask(labels: LabelRow[], taskLabels: TaskLabelRow[], taskId: string): LabelRow[] {
  const liveLabelIds = new Set(
    taskLabels.filter((tl) => tl.task_id === taskId && tl.deleted_at === null).map((tl) => tl.label_id)
  )
  return labels.filter((label) => liveLabelIds.has(label.id) && label.deleted_at === null)
}

export function selectSortedLabels(labels: LabelRow[]): LabelRow[] {
  return labels
    .filter((label) => label.deleted_at === null)
    .sort((a, b) => {
      if (a.label_order !== b.label_order) return a.label_order - b.label_order
      return a.name.localeCompare(b.name)
    })
}

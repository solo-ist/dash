import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import type { DashApi } from '../../shared/api'
import type { ReminderRow } from '../../shared/types'

export type ReminderStore = UseBoundStore<StoreApi<ReminderState>>

export interface ReminderAddInput {
  taskId: string
  kind: 'relative' | 'absolute'
  minuteOffset?: number
  at?: string
}

export interface ReminderUpdatePatch {
  kind?: 'relative' | 'absolute'
  minuteOffset?: number | null
  at?: string | null
}

function requireReminder(result: { reminders?: ReminderRow[] }): ReminderRow {
  const reminder = result.reminders?.[0]
  if (!reminder) throw new Error('mutate did not return a reminder')
  return reminder
}

export interface ReminderState {
  reminders: ReminderRow[]
  loaded: boolean
  error: string | null
  load: () => Promise<void>
  add: (input: ReminderAddInput) => Promise<void>
  update: (id: string, patch: ReminderUpdatePatch) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function createReminderStore(api: DashApi): ReminderStore {
  const store = create<ReminderState>()((set, get) => ({
    reminders: [],
    loaded: false,
    error: null,
    load: async () => {
      try {
        const reminders = await api.query('reminders.list', {})
        set({ reminders, loaded: true, error: null })
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    },
    add: async (input: ReminderAddInput) => {
      try {
        const result = await api.mutate({ type: 'reminder.create', ...input })
        const reminder = requireReminder(result)
        set((state) => ({ reminders: [...state.reminders, reminder], error: null }))
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    },
    update: async (id: string, patch: ReminderUpdatePatch) => {
      try {
        const result = await api.mutate({ type: 'reminder.update', id, ...patch })
        const reminder = requireReminder(result)
        set((state) => ({
          reminders: state.reminders.map((r) => (r.id === id ? reminder : r)),
          error: null
        }))
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
      }
    },
    remove: async (id: string) => {
      const prevState = get()
      const reminderToRemove = prevState.reminders.find((r) => r.id === id)
      if (!reminderToRemove) return

      set((state) => ({
        reminders: state.reminders.filter((r) => r.id !== id),
        error: null
      }))

      try {
        await api.mutate({ type: 'reminder.delete', id })
      } catch (err) {
        set({
          reminders: [...get().reminders, reminderToRemove],
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }
  }))

  api.on('data:changed', (payload) => {
    if (payload.entities.includes('reminders')) {
      void store.getState().load()
    }
  })

  return store
}

export function selectRemindersForTask(reminders: ReminderRow[], taskId: string): ReminderRow[] {
  return reminders.filter((r) => r.task_id === taskId && r.deleted_at === null)
}

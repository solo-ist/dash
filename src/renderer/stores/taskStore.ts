import { create } from 'zustand'
import type { DashApi, TaskAddInput } from '../../shared/api'
import type { TaskRow } from '../../shared/types'

export interface TaskState {
  tasks: TaskRow[]
  loaded: boolean
  error: string | null
  load: () => Promise<void>
  add: (input: TaskAddInput) => Promise<void>
  complete: (id: string) => Promise<void>
  uncomplete: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

let tempIdCounter = 0

export function createTaskStore(api: DashApi): TaskState {
  return create<TaskState>()((set, get) => ({
    tasks: [],
    loaded: false,
    error: null,
    load: async () => {
      try {
        const tasks = await api.tasks.list()
        set({ tasks, loaded: true, error: null })
      } catch (err) {
        set({ error: String(err) })
      }
    },
    add: async (input: TaskAddInput) => {
      const tempId = `temp-${++tempIdCounter}`
      const tempTask: TaskRow = {
        id: tempId,
        checked: 0,
        content: input.content,
        description: input.description ?? '',
        project_id: input.projectId ?? '',
        section_id: input.sectionId ?? null,
        parent_id: null,
        priority: input.priority ?? 4,
        due_date: input.dueDate ?? null,
        due_has_time: input.dueHasTime ? 1 : 0,
        recur_string: input.recurString ?? null,
        recur_strict: input.recurStrict ? 1 : 0,
        recur_ends: null,
        deadline_date: null,
        duration_min: input.durationMin ?? null,
        task_order: 0,
        is_header: 0,
        completed_at: null,
        added_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null
      }

      // Optimistically add the temporary task
      set((state) => ({
        tasks: [...state.tasks, tempTask],
        error: null
      }))

      try {
        const newTask = await api.tasks.add(input)
        set((state) => ({
          tasks: state.tasks.map(task => task.id === tempId ? newTask : task)
        }))
      } catch (err) {
        // Rollback on failure
        set((state) => ({
          tasks: state.tasks.filter(task => task.id !== tempId),
          error: String(err)
        }))
      }
    },
    complete: async (id: string) => {
      const prevState = get()
      const taskToComplete = prevState.tasks.find(task => task.id === id)
      
      if (!taskToComplete) return
      
      // Optimistically mark as complete
      set((state) => ({
        tasks: state.tasks.map(task => 
          task.id === id ? { ...task, checked: 1, completed_at: new Date().toISOString() } : task
        ),
        error: null
      }))

      try {
        const completedTask = await api.tasks.complete(id)
        set((state) => ({
          tasks: state.tasks.map(task => 
            task.id === id ? completedTask : task
          )
        }))
      } catch (err) {
        // Rollback on failure
        set((state) => ({
          tasks: state.tasks.map(task => 
            task.id === id ? taskToComplete : task
          ),
          error: String(err)
        }))
      }
    },
    uncomplete: async (id: string) => {
      const prevState = get()
      const taskToUncomplete = prevState.tasks.find(task => task.id === id)
      
      if (!taskToUncomplete) return
      
      // Optimistically mark as incomplete
      set((state) => ({
        tasks: state.tasks.map(task => 
          task.id === id ? { ...task, checked: 0, completed_at: null } : task
        ),
        error: null
      }))

      try {
        const uncompletedTask = await api.tasks.uncomplete(id)
        set((state) => ({
          tasks: state.tasks.map(task => 
            task.id === id ? uncompletedTask : task
          )
        }))
      } catch (err) {
        // Rollback on failure
        set((state) => ({
          tasks: state.tasks.map(task => 
            task.id === id ? taskToUncomplete : task
          ),
          error: String(err)
        }))
      }
    },
    remove: async (id: string) => {
      const prevState = get()
      const taskToRemove = prevState.tasks.find(task => task.id === id)
      
      if (!taskToRemove) return
      
      // Optimistically remove the task
      set((state) => ({
        tasks: state.tasks.filter(task => task.id !== id),
        error: null
      }))

      try {
        await api.tasks.delete(id)
      } catch (err) {
        // Rollback on failure
        set((state) => ({
          tasks: [...state.tasks, taskToRemove],
          error: String(err)
        }))
      }
    }
  }))
}

export function selectOpenTasks(tasks: TaskRow[], projectId: string): TaskRow[] {
  return tasks
    .filter(task => task.checked === 0 && task.deleted_at === null && task.project_id === projectId)
    .sort((a, b) => new Date(a.added_at).getTime() - new Date(b.added_at).getTime())
}

export function selectAllOpenTasks(tasks: TaskRow[]): TaskRow[] {
  return tasks
    .filter(task => task.checked === 0 && task.deleted_at === null)
    .sort((a, b) => new Date(a.added_at).getTime() - new Date(b.added_at).getTime())
}
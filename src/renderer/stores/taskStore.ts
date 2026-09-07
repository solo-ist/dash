import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import type { DashApi, TaskAddInput } from '../../shared/api'
import type { TaskRow } from '../../shared/types'
import type { Op } from '../../shared/ops'

export type TaskStore = UseBoundStore<StoreApi<TaskState>>

export type TaskUpdatePatch = Omit<Extract<Op, { type: 'task.update' }>, 'type' | 'id'>

export interface TaskState {
  tasks: TaskRow[]
  loaded: boolean
  error: string | null
  load: () => Promise<void>
  add: (input: TaskAddInput) => Promise<void>
  addSubtask: (parentId: string, content: string) => Promise<void>
  update: (id: string, patch: TaskUpdatePatch) => Promise<void>
  complete: (id: string) => Promise<void>
  uncomplete: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  undelete: (id: string) => Promise<void>
}

let tempIdCounter = 0

function requireTask(result: { tasks?: TaskRow[] }): TaskRow {
  const task = result.tasks?.[0]
  if (!task) throw new Error('mutate did not return a task')
  return task
}

export function createTaskStore(api: DashApi): TaskStore {
  return create<TaskState>()((set, get) => ({
    tasks: [],
    loaded: false,
    error: null,
    load: async () => {
      try {
        const tasks = await api.query('tasks.list', {})
        set({ tasks, loaded: true, error: null })
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
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
        parent_id: input.parentId ?? null,
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
        const result = await api.mutate({ type: 'task.add', ...input })
        const newTask = requireTask(result)
        set((state) => ({
          tasks: state.tasks.map(task => task.id === tempId ? newTask : task)
        }))
      } catch (err) {
        // Rollback on failure
        set((state) => ({
          tasks: state.tasks.filter(task => task.id !== tempId),
          error: err instanceof Error ? err.message : String(err)
        }))
      }
    },
    addSubtask: async (parentId: string, content: string) => {
      const parent = get().tasks.find(task => task.id === parentId)
      await get().add({
        content,
        parentId,
        projectId: parent?.project_id,
        sectionId: parent?.section_id ?? undefined
      })
    },
    update: async (id: string, patch: TaskUpdatePatch) => {
      const prevState = get()
      const taskToUpdate = prevState.tasks.find(task => task.id === id)

      if (!taskToUpdate) return

      const optimisticTask: TaskRow = {
        ...taskToUpdate,
        ...(patch.content !== undefined ? { content: patch.content } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.projectId !== undefined ? { project_id: patch.projectId } : {}),
        ...(patch.sectionId !== undefined ? { section_id: patch.sectionId } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.dueDate !== undefined ? { due_date: patch.dueDate } : {}),
        ...(patch.dueHasTime !== undefined ? { due_has_time: patch.dueHasTime ? 1 : 0 } : {}),
        ...(patch.durationMin !== undefined ? { duration_min: patch.durationMin } : {}),
        updated_at: new Date().toISOString()
      }

      // Optimistically apply the patch
      set((state) => ({
        tasks: state.tasks.map(task =>
          task.id === id ? optimisticTask : task
        ),
        error: null
      }))

      try {
        const result = await api.mutate({ type: 'task.update', id, ...patch })
        const updatedTask = requireTask(result)
        set((state) => ({
          tasks: state.tasks.map(task =>
            task.id === id ? updatedTask : task
          )
        }))
      } catch (err) {
        // Rollback on failure
        set((state) => ({
          tasks: state.tasks.map(task =>
            task.id === id ? taskToUpdate : task
          ),
          error: err instanceof Error ? err.message : String(err)
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
        const result = await api.mutate({ type: 'task.complete', id })
        const completedTask = requireTask(result)
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
          error: err instanceof Error ? err.message : String(err)
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
        const result = await api.mutate({ type: 'task.uncomplete', id })
        const uncompletedTask = requireTask(result)
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
          error: err instanceof Error ? err.message : String(err)
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
        await api.mutate({ type: 'task.delete', id })
      } catch (err) {
        // Rollback on failure
        set((state) => ({
          tasks: [...state.tasks, taskToRemove],
          error: err instanceof Error ? err.message : String(err)
        }))
      }
    },
    undelete: async (id: string) => {
      try {
        const result = await api.mutate({ type: 'task.undelete', id })
        const restored = requireTask(result)
        set((state) => ({
          tasks: [...state.tasks.filter(task => task.id !== restored.id), restored],
          error: null
        }))
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
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

export interface NestedTask {
  task: TaskRow
  depth: number
}

// Given a flat, already-scoped task list (e.g. one project/section), produce a
// display order where top-level tasks keep their input order and each task's
// children are flattened directly beneath it, depth-first. A task whose parent
// isn't part of the given list (e.g. filtered out elsewhere) is treated as
// top-level rather than dropped.
export function nestTasksByParent(tasks: TaskRow[]): NestedTask[] {
  const visible = tasks.filter(task => task.deleted_at === null)
  const idSet = new Set(visible.map(task => task.id))
  const childrenByParent = new Map<string, TaskRow[]>()

  for (const task of visible) {
    if (task.parent_id !== null && idSet.has(task.parent_id)) {
      const siblings = childrenByParent.get(task.parent_id)
      if (siblings) siblings.push(task)
      else childrenByParent.set(task.parent_id, [task])
    }
  }

  const result: NestedTask[] = []
  function walk(task: TaskRow, depth: number): void {
    result.push({ task, depth })
    const children = childrenByParent.get(task.id)
    if (children === undefined) return
    for (const child of children) walk(child, depth + 1)
  }

  for (const task of visible) {
    if (task.parent_id === null || !idSet.has(task.parent_id)) walk(task, 0)
  }

  return result
}

export interface SubtaskCounts {
  total: number
  completed: number
}

// Counts a task's direct (non-deleted) children — used for the "1/3" subtask chip.
export function subtaskCounts(tasks: TaskRow[], parentId: string): SubtaskCounts {
  const children = tasks.filter(task => task.parent_id === parentId && task.deleted_at === null)
  return {
    total: children.length,
    completed: children.filter(task => task.checked === 1).length
  }
}
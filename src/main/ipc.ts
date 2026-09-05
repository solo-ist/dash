import type Database from 'better-sqlite3'
import { ipcMain } from 'electron'
import { z } from 'zod'
import { OpSchema } from '../shared/ops'
import { mutate } from './mutate'
import { listProjects, listTasks } from './queries'
import type { ProjectRow, TaskRow } from '../shared/types'

function requireTask(result: { tasks?: TaskRow[] }): TaskRow {
  const task = result.tasks?.[0]
  if (!task) throw new Error('mutate did not return a task')
  return task
}

export function registerIpc(db: Database): void {
  ipcMain.handle('tasks:list', (_event, projectId: unknown): TaskRow[] => {
    const parsed = z.string().optional().parse(projectId)
    return listTasks(db, parsed)
  })

  ipcMain.handle('tasks:add', (_event, input: unknown): TaskRow => {
    const op = OpSchema.parse({ type: 'task.add' as const, ...(input as Record<string, unknown>) })
    return requireTask(mutate(db, op))
  })

  ipcMain.handle('tasks:complete', (_event, id: unknown): TaskRow => {
    const parsed = z.string().parse(id)
    return requireTask(mutate(db, { type: 'task.complete', id: parsed }))
  })

  ipcMain.handle('tasks:uncomplete', (_event, id: unknown): TaskRow => {
    const parsed = z.string().parse(id)
    return requireTask(mutate(db, { type: 'task.uncomplete', id: parsed }))
  })

  ipcMain.handle('tasks:delete', (_event, id: unknown): TaskRow => {
    const parsed = z.string().parse(id)
    return requireTask(mutate(db, { type: 'task.delete', id: parsed }))
  })

  ipcMain.handle('tasks:undelete', (_event, id: unknown): TaskRow => {
    const parsed = z.string().parse(id)
    return requireTask(mutate(db, { type: 'task.undelete', id: parsed }))
  })

  ipcMain.handle('projects:list', (): ProjectRow[] => {
    return listProjects(db)
  })
}

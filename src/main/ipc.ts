import type Database from 'better-sqlite3'
import { BrowserWindow, ipcMain } from 'electron'
import { OpSchema } from '../shared/ops'
import { QueryParamsSchemas, type QueryName } from '../shared/queries'
import type { DataChangedPayload } from '../shared/api'
import type { MutateResult } from '../shared/types'
import { mutate } from './mutate'
import { listLabels, listProjects, listSections, listTaskLabels, listTasks } from './queries'

function isQueryName(name: unknown): name is QueryName {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(QueryParamsSchemas, name)
}

function runQuery(db: Database, name: QueryName, params: unknown): unknown {
  switch (name) {
    case 'tasks.list': {
      const parsed = QueryParamsSchemas['tasks.list'].parse(params)
      return listTasks(db, parsed.projectId)
    }
    case 'projects.list': {
      QueryParamsSchemas['projects.list'].parse(params)
      return listProjects(db)
    }
    case 'sections.list': {
      const parsed = QueryParamsSchemas['sections.list'].parse(params)
      return listSections(db, parsed.projectId)
    }
    case 'labels.list': {
      QueryParamsSchemas['labels.list'].parse(params)
      return listLabels(db)
    }
    case 'taskLabels.list': {
      QueryParamsSchemas['taskLabels.list'].parse(params)
      return listTaskLabels(db)
    }
    case 'tasks.today': {
      const parsed = QueryParamsSchemas['tasks.today'].parse(params)
      return listTodayTasks(db, parsed.today)
    }
    case 'tasks.upcoming': {
      const parsed = QueryParamsSchemas['tasks.upcoming'].parse(params)
      return listUpcomingTasks(db, parsed.today, parsed.horizonDays)
    }
    default: {
      const exhaustive: never = name
      throw new Error(`unknown query: ${String(exhaustive)}`)
    }
  }
}

function entitiesFor(result: MutateResult): string[] {
  const entities: string[] = []
  if (result.tasks !== undefined) entities.push('tasks')
  if (result.projects !== undefined) entities.push('projects')
  if (result.sections !== undefined) entities.push('sections')
  if (result.labels !== undefined) entities.push('labels')
  if (result.taskLabels !== undefined) entities.push('taskLabels')
  return entities
}

function broadcastDataChanged(entities: string[]): void {
  if (entities.length === 0) return
  const payload: DataChangedPayload = { entities }
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('data:changed', payload)
  }
}

export function registerIpc(db: Database): void {
  ipcMain.handle('db:query', (_event, name: unknown, params: unknown): unknown => {
    if (!isQueryName(name)) throw new Error(`unknown query: ${String(name)}`)
    return runQuery(db, name, params)
  })

  ipcMain.handle('db:mutate', (_event, op: unknown): MutateResult => {
    const validated = OpSchema.parse(op)
    const result = mutate(db, validated)
    broadcastDataChanged(entitiesFor(result))
    return result
  })
}

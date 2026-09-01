import type Database from 'better-sqlite3'
import type { ProjectRow, TaskRow } from '../shared/types'

export function getTask(db: Database, id: string): TaskRow | undefined {
  return db
    .prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL')
    .get(id) as TaskRow | undefined
}

export function listTasks(db: Database, projectId?: string): TaskRow[] {
  if (projectId !== undefined) {
    return db
      .prepare('SELECT * FROM tasks WHERE project_id = ? AND deleted_at IS NULL')
      .all(projectId) as TaskRow[]
  }
  return db.prepare('SELECT * FROM tasks WHERE deleted_at IS NULL').all() as TaskRow[]
}

export function getProject(db: Database, id: string): ProjectRow | undefined {
  return db
    .prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL')
    .get(id) as ProjectRow | undefined
}

export function listProjects(db: Database): ProjectRow[] {
  return db.prepare('SELECT * FROM projects WHERE deleted_at IS NULL').all() as ProjectRow[]
}

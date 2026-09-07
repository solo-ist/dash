import type Database from 'better-sqlite3'
import type { LabelRow, ProjectRow, SectionRow, TaskLabelRow, TaskRow } from '../shared/types'

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

export function listSections(db: Database, projectId?: string): SectionRow[] {
  if (projectId !== undefined) {
    return db
      .prepare(
        'SELECT * FROM sections WHERE project_id = ? AND deleted_at IS NULL ORDER BY section_order'
      )
      .all(projectId) as SectionRow[]
  }
  return db
    .prepare('SELECT * FROM sections WHERE deleted_at IS NULL ORDER BY section_order')
    .all() as SectionRow[]
}

export function listLabels(db: Database): LabelRow[] {
  return db
    .prepare('SELECT * FROM labels WHERE deleted_at IS NULL ORDER BY label_order, name')
    .all() as LabelRow[]
}

export function listTaskLabels(db: Database): TaskLabelRow[] {
  return db.prepare('SELECT * FROM task_labels WHERE deleted_at IS NULL').all() as TaskLabelRow[]
}

import type Database from 'better-sqlite3'
import { nanoid } from 'nanoid'
import { OpSchema, type Op } from '../shared/ops'
import type { MutateResult, ProjectRow, TaskRow } from '../shared/types'

function nowIso(): string {
  return new Date().toISOString()
}

function readTaskRow(db: Database, id: string): TaskRow | undefined {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
}

function readProjectRow(db: Database, id: string): ProjectRow | undefined {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
}

function requireTaskRow(db: Database, id: string): TaskRow {
  const row = readTaskRow(db, id)
  if (!row || row.deleted_at !== null) throw new Error(`task not found: ${id}`)
  return row
}

function requireProjectRow(db: Database, id: string): ProjectRow {
  const row = readProjectRow(db, id)
  if (!row || row.deleted_at !== null) throw new Error(`project not found: ${id}`)
  return row
}

function findOrCreateInboxProjectId(db: Database, now: string): string {
  const existing = db
    .prepare('SELECT id FROM projects WHERE is_inbox = 1 AND deleted_at IS NULL LIMIT 1')
    .get() as { id: string } | undefined
  if (existing) return existing.id

  const id = nanoid(21)
  db.prepare(
    `INSERT INTO projects (id, name, is_inbox, updated_at)
     VALUES (?, 'Inbox', 1, ?)`
  ).run(id, now)
  return id
}

function addTask(db: Database, op: Extract<Op, { type: 'task.add' }>): TaskRow {
  const now = nowIso()
  const id = nanoid(21)
  const projectId = op.projectId ?? findOrCreateInboxProjectId(db, now)

  db.prepare(
    `INSERT INTO tasks (
       id, content, description, project_id, section_id, priority,
       due_date, due_has_time, recur_string, recur_strict, duration_min,
       task_order, added_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    op.content,
    op.description ?? '',
    projectId,
    op.sectionId ?? null,
    op.priority ?? 4,
    op.dueDate ?? null,
    op.dueHasTime ? 1 : 0,
    op.recurString ?? null,
    op.recurStrict ? 1 : 0,
    op.durationMin ?? null,
    0,
    now,
    now
  )

  return requireTaskRow(db, id)
}

function updateTask(db: Database, op: Extract<Op, { type: 'task.update' }>): TaskRow {
  requireTaskRow(db, op.id)
  const now = nowIso()

  const fields: Array<[string, unknown]> = []
  if (op.content !== undefined) fields.push(['content', op.content])
  if (op.description !== undefined) fields.push(['description', op.description])
  if (op.projectId !== undefined) fields.push(['project_id', op.projectId])
  if (op.sectionId !== undefined) fields.push(['section_id', op.sectionId])
  if (op.priority !== undefined) fields.push(['priority', op.priority])
  if (op.dueDate !== undefined) fields.push(['due_date', op.dueDate])
  if (op.dueHasTime !== undefined) fields.push(['due_has_time', op.dueHasTime ? 1 : 0])
  if (op.recurString !== undefined) fields.push(['recur_string', op.recurString])
  if (op.recurStrict !== undefined) fields.push(['recur_strict', op.recurStrict ? 1 : 0])
  if (op.durationMin !== undefined) fields.push(['duration_min', op.durationMin])
  fields.push(['updated_at', now])

  const setClause = fields.map(([column]) => `${column} = ?`).join(', ')
  const values = fields.map(([, value]) => value)

  db.prepare(`UPDATE tasks SET ${setClause} WHERE id = ?`).run(...values, op.id)

  return requireTaskRow(db, op.id)
}

function completeTask(db: Database, op: Extract<Op, { type: 'task.complete' }>): TaskRow {
  const task = requireTaskRow(db, op.id)
  const now = nowIso()

  db.prepare(
    `INSERT INTO completions (task_id, content, project_id, completed_at)
     VALUES (?, ?, ?, ?)`
  ).run(task.id, task.content, task.project_id, now)

  // TODO(recur engine, later issue): when task.recur_string is set, this
  // should recompute due_date instead of checking the task off for good.
  db.prepare('UPDATE tasks SET checked = 1, completed_at = ?, updated_at = ? WHERE id = ?').run(
    now,
    now,
    op.id
  )

  return requireTaskRow(db, op.id)
}

function uncompleteTask(db: Database, op: Extract<Op, { type: 'task.uncomplete' }>): TaskRow {
  requireTaskRow(db, op.id)
  const now = nowIso()

  db.prepare(
    `DELETE FROM completions WHERE rowid = (
       SELECT rowid FROM completions WHERE task_id = ? ORDER BY completed_at DESC LIMIT 1
     )`
  ).run(op.id)

  db.prepare('UPDATE tasks SET checked = 0, completed_at = NULL, updated_at = ? WHERE id = ?').run(
    now,
    op.id
  )

  return requireTaskRow(db, op.id)
}

function deleteTask(db: Database, op: Extract<Op, { type: 'task.delete' }>): TaskRow {
  requireTaskRow(db, op.id)
  const now = nowIso()
  db.prepare('UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, op.id)

  const row = readTaskRow(db, op.id)
  if (!row) throw new Error(`task not found after delete: ${op.id}`)
  return row
}

function addProject(db: Database, op: Extract<Op, { type: 'project.add' }>): ProjectRow {
  const now = nowIso()
  const id = nanoid(21)

  db.prepare(
    `INSERT INTO projects (id, name, color, is_favorite, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, op.name, op.color ?? 'charcoal', op.isFavorite ? 1 : 0, now)

  return requireProjectRow(db, id)
}

function updateProject(db: Database, op: Extract<Op, { type: 'project.update' }>): ProjectRow {
  requireProjectRow(db, op.id)
  const now = nowIso()

  const fields: Array<[string, unknown]> = []
  if (op.name !== undefined) fields.push(['name', op.name])
  if (op.color !== undefined) fields.push(['color', op.color])
  if (op.isFavorite !== undefined) fields.push(['is_favorite', op.isFavorite ? 1 : 0])
  fields.push(['updated_at', now])

  const setClause = fields.map(([column]) => `${column} = ?`).join(', ')
  const values = fields.map(([, value]) => value)

  db.prepare(`UPDATE projects SET ${setClause} WHERE id = ?`).run(...values, op.id)

  return requireProjectRow(db, op.id)
}

function deleteProject(db: Database, op: Extract<Op, { type: 'project.delete' }>): ProjectRow {
  requireProjectRow(db, op.id)
  const now = nowIso()
  db.prepare('UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ?').run(
    now,
    now,
    op.id
  )

  const row = readProjectRow(db, op.id)
  if (!row) throw new Error(`project not found after delete: ${op.id}`)
  return row
}

function applyOp(db: Database, op: Op): MutateResult {
  switch (op.type) {
    case 'task.add':
      return { tasks: [addTask(db, op)] }
    case 'task.update':
      return { tasks: [updateTask(db, op)] }
    case 'task.complete':
      return { tasks: [completeTask(db, op)] }
    case 'task.delete':
      return { tasks: [deleteTask(db, op)] }
    case 'task.uncomplete':
      return { tasks: [uncompleteTask(db, op)] }
    case 'project.add':
      return { projects: [addProject(db, op)] }
    case 'project.update':
      return { projects: [updateProject(db, op)] }
    case 'project.delete':
      return { projects: [deleteProject(db, op)] }
    default: {
      const exhaustive: never = op
      throw new Error(`mutate: unknown op ${JSON.stringify(exhaustive)}`)
    }
  }
}

export function mutate(db: Database, op: Op): MutateResult {
  const validated = OpSchema.parse(op)
  const run = db.transaction((): MutateResult => applyOp(db, validated))
  return run()
}

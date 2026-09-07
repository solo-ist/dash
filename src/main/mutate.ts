import type Database from 'better-sqlite3'
import { nanoid } from 'nanoid'
import { OpSchema, type Op } from '../shared/ops'
import type { MutateResult, ProjectRow, SectionRow, TaskRow } from '../shared/types'

function nowIso(): string {
  return new Date().toISOString()
}

function readTaskRow(db: Database, id: string): TaskRow | undefined {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
}

function readProjectRow(db: Database, id: string): ProjectRow | undefined {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
}

function readSectionRow(db: Database, id: string): SectionRow | undefined {
  return db.prepare('SELECT * FROM sections WHERE id = ?').get(id) as SectionRow | undefined
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

function requireSectionRow(db: Database, id: string): SectionRow {
  const row = readSectionRow(db, id)
  if (!row || row.deleted_at !== null) throw new Error(`section not found: ${id}`)
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
  
  let projectId = op.projectId ?? findOrCreateInboxProjectId(db, now)
  let sectionId = op.sectionId ?? null
  
  // Handle subtasks
  if (op.parentId !== undefined && op.parentId !== null) {
    const parent = requireTaskRow(db, op.parentId)
    projectId = parent.project_id
    sectionId = parent.section_id
  }

  db.prepare(
    `INSERT INTO tasks (
       id, content, description, project_id, section_id, priority,
       due_date, due_has_time, recur_string, recur_strict, duration_min,
       parent_id, task_order, added_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    op.content,
    op.description ?? '',
    projectId,
    sectionId,
    op.priority ?? 4,
    op.dueDate ?? null,
    op.dueHasTime ? 1 : 0,
    op.recurString ?? null,
    op.recurStrict ? 1 : 0,
    op.durationMin ?? null,
    op.parentId ?? null,
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
  
  // Handle parentId updates
  if (op.parentId !== undefined) {
    if (op.parentId === null) {
      fields.push(['parent_id', null])
    } else if (op.parentId === op.id) {
      throw new Error('task cannot be its own parent')
    } else {
      const parent = requireTaskRow(db, op.parentId)
      
      // Cycle guard - walk up the parent chain
      let cur = parent.parent_id
      while (cur !== null) {
        if (cur === op.id) {
          throw new Error('parent change would create a cycle')
        }
        const parentRow = readTaskRow(db, cur)
        cur = parentRow?.parent_id ?? null
      }
      
      fields.push(['parent_id', parent.id])
      fields.push(['project_id', parent.project_id])
      fields.push(['section_id', parent.section_id])
    }
  }
  
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

function deleteTask(db: Database, op: Extract<Op, { type: 'task.delete' }>): TaskRow[] {
  requireTaskRow(db, op.id)
  const now = nowIso()
  
  // Collect all open descendant ids iteratively
  const descendants: string[] = []
  const stack = [op.id]
  while (stack.length > 0) {
    const id = stack.pop()!
    const rows = db.prepare('SELECT id FROM tasks WHERE parent_id = ? AND deleted_at IS NULL').all(id) as Array<{id: string}>
    for (const row of rows) {
      stack.push(row.id)
      descendants.push(row.id)
    }
  }
  
  // Delete the task and all descendants
  const allIds = [op.id, ...descendants]
  for (const id of allIds) {
    db.prepare('UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, id)
  }
  
  // Return all affected rows
  const result: TaskRow[] = []
  for (const id of allIds) {
    const row = readTaskRow(db, id)
    if (!row) throw new Error(`task not found after delete: ${id}`)
    result.push(row)
  }
  
  return result
}

function undeleteTask(db: Database, op: Extract<Op, { type: 'task.undelete' }>): TaskRow[] {
  const row = readTaskRow(db, op.id)
  if (!row) throw new Error(`task not found: ${op.id}`)
  const now = nowIso()
  
  const originalDeletedAt = row.deleted_at
  
  // Restore the task itself
  db.prepare('UPDATE tasks SET deleted_at = NULL, updated_at = ? WHERE id = ?').run(now, op.id)
  
  const result: TaskRow[] = [requireTaskRow(db, op.id)]
  
  // If this was a deleted task, also restore descendants
  if (originalDeletedAt !== null) {
    // Collect all descendant ids that were deleted at the same time
    const descendants: string[] = []
    const stack = [op.id]
    while (stack.length > 0) {
      const id = stack.pop()!
      const rows = db.prepare('SELECT id FROM tasks WHERE parent_id = ? AND deleted_at = ?').all(id, originalDeletedAt) as Array<{id: string}>
      for (const row of rows) {
        stack.push(row.id)
        descendants.push(row.id)
      }
    }
    
    // Restore all descendants
    for (const id of descendants) {
      db.prepare('UPDATE tasks SET deleted_at = NULL, updated_at = ? WHERE id = ?').run(now, id)
    }
    
    // Add restored descendants to result
    for (const id of descendants) {
      result.push(requireTaskRow(db, id))
    }
  }
  
  return result
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

function archiveProject(db: Database, op: Extract<Op, { type: 'project.archive' }>): ProjectRow {
  requireProjectRow(db, op.id)
  const now = nowIso()
  db.prepare('UPDATE projects SET archived_at = ?, updated_at = ? WHERE id = ?').run(
    now,
    now,
    op.id
  )
  return requireProjectRow(db, op.id)
}

function unarchiveProject(db: Database, op: Extract<Op, { type: 'project.unarchive' }>): ProjectRow {
  requireProjectRow(db, op.id)
  const now = nowIso()
  db.prepare('UPDATE projects SET archived_at = NULL, updated_at = ? WHERE id = ?').run(
    now,
    op.id
  )
  return requireProjectRow(db, op.id)
}

function addSection(db: Database, op: Extract<Op, { type: 'section.add' }>): SectionRow {
  requireProjectRow(db, op.projectId)
  const now = nowIso()
  const id = nanoid(21)

  db.prepare(
    `INSERT INTO sections (id, project_id, name, updated_at)
     VALUES (?, ?, ?, ?)`
  ).run(id, op.projectId, op.name, now)

  return requireSectionRow(db, id)
}

function updateSection(db: Database, op: Extract<Op, { type: 'section.update' }>): SectionRow {
  requireSectionRow(db, op.id)
  const now = nowIso()

  const fields: Array<[string, unknown]> = []
  if (op.name !== undefined) fields.push(['name', op.name])
  fields.push(['updated_at', now])

  const setClause = fields.map(([column]) => `${column} = ?`).join(', ')
  const values = fields.map(([, value]) => value)

  db.prepare(`UPDATE sections SET ${setClause} WHERE id = ?`).run(...values, op.id)

  return requireSectionRow(db, op.id)
}

function deleteSection(db: Database, op: Extract<Op, { type: 'section.delete' }>): SectionRow {
  requireSectionRow(db, op.id)
  const now = nowIso()
  db.prepare('UPDATE sections SET deleted_at = ?, updated_at = ? WHERE id = ?').run(
    now,
    now,
    op.id
  )

  const row = readSectionRow(db, op.id)
  if (!row) throw new Error(`section not found after delete: ${op.id}`)
  return row
}

function archiveSection(db: Database, op: Extract<Op, { type: 'section.archive' }>): SectionRow {
  requireSectionRow(db, op.id)
  const now = nowIso()
  db.prepare('UPDATE sections SET archived_at = ?, updated_at = ? WHERE id = ?').run(
    now,
    now,
    op.id
  )
  return requireSectionRow(db, op.id)
}

function unarchiveSection(db: Database, op: Extract<Op, { type: 'section.unarchive' }>): SectionRow {
  requireSectionRow(db, op.id)
  const now = nowIso()
  db.prepare('UPDATE sections SET archived_at = NULL, updated_at = ? WHERE id = ?').run(
    now,
    op.id
  )
  return requireSectionRow(db, op.id)
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
      return { tasks: deleteTask(db, op) }
    case 'task.uncomplete':
      return { tasks: [uncompleteTask(db, op)] }
    case 'task.undelete':
      return { tasks: undeleteTask(db, op) }
    case 'project.add':
      return { projects: [addProject(db, op)] }
    case 'project.update':
      return { projects: [updateProject(db, op)] }
    case 'project.delete':
      return { projects: [deleteProject(db, op)] }
    case 'project.archive':
      return { projects: [archiveProject(db, op)] }
    case 'project.unarchive':
      return { projects: [unarchiveProject(db, op)] }
    case 'section.add':
      return { sections: [addSection(db, op)] }
    case 'section.update':
      return { sections: [updateSection(db, op)] }
    case 'section.delete':
      return { sections: [deleteSection(db, op)] }
    case 'section.archive':
      return { sections: [archiveSection(db, op)] }
    case 'section.unarchive':
      return { sections: [unarchiveSection(db, op)] }
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

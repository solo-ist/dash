import type Database from 'better-sqlite3'
import { nanoid } from 'nanoid'
import { OpSchema, type Op } from '../shared/ops'
import { insertionKeys, keyAfter } from '../shared/order/keys'
import { planReorder, type SiblingEntry } from '../shared/order/reorder'
import { nextOccurrence, parseRecur } from '../shared/recur'
import type {
  LabelRow,
  MutateResult,
  ProjectRow,
  ReminderRow,
  SectionRow,
  TaskLabelRow,
  TaskRow
} from '../shared/types'

type MutatedListener = () => void
let onMutated: MutatedListener | null = null

/** Registered by src/main/index.ts to re-arm the reminder scheduler after any
 * mutation that could change fire times, without importing electron here. */
export function setOnMutated(listener: MutatedListener | null): void {
  onMutated = listener
}

function nowIso(): string {
  return new Date().toISOString()
}

/** Current moment as a local wall-time datetime string (never UTC) — matches
 * src/shared/quickadd/parse.ts's formatDate. Used only as a recurrence base
 * for `every!` (strict) completions; updated_at/completed_at stay UTC via nowIso(). */
function localWallNow(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:00`
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

function maxTaskOrderInScope(
  db: Database,
  projectId: string,
  sectionId: string | null,
  parentId: string | null
): number | null {
  const row = db
    .prepare(
      `SELECT MAX(task_order) as maxOrder FROM tasks
       WHERE project_id = ? AND section_id IS ? AND parent_id IS ? AND deleted_at IS NULL`
    )
    .get(projectId, sectionId, parentId) as { maxOrder: number | null }
  return row.maxOrder
}

function taskOrderScopeSiblings(
  db: Database,
  projectId: string,
  sectionId: string | null,
  parentId: string | null,
  excludeId?: string
): SiblingEntry[] {
  const rows = db
    .prepare(
      `SELECT id, task_order FROM tasks
       WHERE project_id = ? AND section_id IS ? AND parent_id IS ? AND deleted_at IS NULL
       ORDER BY task_order, added_at, id`
    )
    .all(projectId, sectionId, parentId) as Array<{ id: string; task_order: number }>
  return rows
    .filter((row) => row.id !== excludeId)
    .map((row) => ({ id: row.id, key: row.task_order }))
}

function readLabelRow(db: Database, id: string): LabelRow | undefined {
  return db.prepare('SELECT * FROM labels WHERE id = ?').get(id) as LabelRow | undefined
}

function requireLabelRow(db: Database, id: string): LabelRow {
  const row = readLabelRow(db, id)
  if (!row || row.deleted_at !== null) throw new Error(`label not found: ${id}`)
  return row
}

function findLiveLabelByNameExact(db: Database, name: string): LabelRow | undefined {
  return db
    .prepare('SELECT * FROM labels WHERE name = ? AND deleted_at IS NULL')
    .get(name) as LabelRow | undefined
}

function findLiveLabelByNameCaseInsensitive(db: Database, name: string): LabelRow | undefined {
  return db
    .prepare('SELECT * FROM labels WHERE name = ? COLLATE NOCASE AND deleted_at IS NULL')
    .get(name) as LabelRow | undefined
}

function findLabelByNameAnyState(db: Database, name: string): LabelRow | undefined {
  return db.prepare('SELECT * FROM labels WHERE name = ?').get(name) as LabelRow | undefined
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

function findOrCreateLabelByName(db: Database, name: string, now: string): LabelRow {
  const existing = findLiveLabelByNameCaseInsensitive(db, name)
  if (existing) return existing

  const id = nanoid(21)
  db.prepare(
    `INSERT INTO labels (id, name, updated_at)
     VALUES (?, ?, ?)`
  ).run(id, name, now)
  return requireLabelRow(db, id)
}

function attachTaskLabelsByName(
  db: Database,
  taskId: string,
  names: string[]
): { labels: LabelRow[]; taskLabels: TaskLabelRow[] } {
  const now = nowIso()
  const labels: LabelRow[] = []
  const taskLabels: TaskLabelRow[] = []
  const seen = new Set<string>()

  for (const name of names) {
    const label = findOrCreateLabelByName(db, name, now)
    if (seen.has(label.id)) continue
    seen.add(label.id)
    labels.push(label)

    db.prepare(
      `INSERT INTO task_labels (task_id, label_id, updated_at, deleted_at)
       VALUES (?, ?, ?, NULL)
       ON CONFLICT (task_id, label_id) DO UPDATE SET updated_at = excluded.updated_at, deleted_at = NULL`
    ).run(taskId, label.id, now)

    const taskLabel = db
      .prepare('SELECT * FROM task_labels WHERE task_id = ? AND label_id = ?')
      .get(taskId, label.id) as TaskLabelRow
    taskLabels.push(taskLabel)
  }

  return { labels, taskLabels }
}

function addTask(db: Database, op: Extract<Op, { type: 'task.add' }>): TaskRow {
  const now = nowIso()
  const id = nanoid(21)
  
  let projectId = op.projectId ?? findOrCreateInboxProjectId(db, now)
  let sectionId = op.sectionId ?? null
  const parentId = op.parentId ?? null

  // Handle subtasks
  if (op.parentId !== undefined && op.parentId !== null) {
    const parent = requireTaskRow(db, op.parentId)
    projectId = parent.project_id
    sectionId = parent.section_id
  }

  const taskOrder = keyAfter(maxTaskOrderInScope(db, projectId, sectionId, parentId))

  db.prepare(
    `INSERT INTO tasks (
       id, content, description, project_id, section_id, priority,
       due_date, due_has_time, recur_string, recur_strict, deadline_date, duration_min,
       parent_id, task_order, added_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    op.deadlineDate ?? null,
    op.durationMin ?? null,
    parentId,
    taskOrder,
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
  if (op.deadlineDate !== undefined) fields.push(['deadline_date', op.deadlineDate])
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

  const rule = task.recur_string ? parseRecur(task.recur_string) : null
  if (rule) {
    const base = rule.strict ? localWallNow() : (task.due_date ?? localWallNow())
    const next = nextOccurrence(rule, base)

    if (next !== null) {
      db.prepare(
        'UPDATE tasks SET due_date = ?, due_has_time = ?, checked = 0, completed_at = NULL, updated_at = ? WHERE id = ?'
      ).run(next, next.includes('T') ? 1 : 0, now, op.id)
      return requireTaskRow(db, op.id)
    }
    // rule.ends has passed: fall through and complete the task for good.
  }

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

function addLabel(db: Database, op: Extract<Op, { type: 'label.add' }>): LabelRow {
  const now = nowIso()

  const liveDuplicate = findLiveLabelByNameExact(db, op.name)
  if (liveDuplicate) throw new Error(`label name already exists: ${op.name}`)

  const existingAnyState = findLabelByNameAnyState(db, op.name)
  if (existingAnyState) {
    // The UNIQUE(name) constraint would collide with a soft-deleted row of
    // the same name, so revive it instead of inserting a fresh row.
    db.prepare(
      `UPDATE labels SET name = ?, color = ?, is_favorite = ?, deleted_at = NULL, updated_at = ?
       WHERE id = ?`
    ).run(op.name, op.color ?? 'charcoal', op.isFavorite ? 1 : 0, now, existingAnyState.id)
    return requireLabelRow(db, existingAnyState.id)
  }

  const id = nanoid(21)
  db.prepare(
    `INSERT INTO labels (id, name, color, is_favorite, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, op.name, op.color ?? 'charcoal', op.isFavorite ? 1 : 0, now)

  return requireLabelRow(db, id)
}

function updateLabel(db: Database, op: Extract<Op, { type: 'label.update' }>): LabelRow {
  requireLabelRow(db, op.id)
  const now = nowIso()

  const fields: Array<[string, unknown]> = []
  if (op.name !== undefined) fields.push(['name', op.name])
  if (op.color !== undefined) fields.push(['color', op.color])
  if (op.isFavorite !== undefined) fields.push(['is_favorite', op.isFavorite ? 1 : 0])
  fields.push(['updated_at', now])

  const setClause = fields.map(([column]) => `${column} = ?`).join(', ')
  const values = fields.map(([, value]) => value)

  db.prepare(`UPDATE labels SET ${setClause} WHERE id = ?`).run(...values, op.id)

  return requireLabelRow(db, op.id)
}

function deleteLabel(db: Database, op: Extract<Op, { type: 'label.delete' }>): { label: LabelRow; taskLabels: TaskLabelRow[] } {
  requireLabelRow(db, op.id)
  const now = nowIso()

  db.prepare('UPDATE labels SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, op.id)

  const affectedTaskLabels = db
    .prepare('SELECT task_id FROM task_labels WHERE label_id = ? AND deleted_at IS NULL')
    .all(op.id) as Array<{ task_id: string }>
  db.prepare('UPDATE task_labels SET deleted_at = ?, updated_at = ? WHERE label_id = ? AND deleted_at IS NULL').run(
    now,
    now,
    op.id
  )

  const taskLabels = affectedTaskLabels.map(
    (row) =>
      db
        .prepare('SELECT * FROM task_labels WHERE task_id = ? AND label_id = ?')
        .get(row.task_id, op.id) as TaskLabelRow
  )

  const row = readLabelRow(db, op.id)
  if (!row) throw new Error(`label not found after delete: ${op.id}`)
  return { label: row, taskLabels }
}

function setTaskLabels(
  db: Database,
  op: Extract<Op, { type: 'task.setLabels' }>
): { taskLabels: TaskLabelRow[] } {
  requireTaskRow(db, op.id)
  const now = nowIso()
  const keepIds = new Set(op.labelIds)

  const current = db
    .prepare('SELECT * FROM task_labels WHERE task_id = ? AND deleted_at IS NULL')
    .all(op.id) as TaskLabelRow[]

  for (const row of current) {
    if (!keepIds.has(row.label_id)) {
      db.prepare(
        'UPDATE task_labels SET deleted_at = ?, updated_at = ? WHERE task_id = ? AND label_id = ?'
      ).run(now, now, op.id, row.label_id)
    }
  }

  const taskLabels: TaskLabelRow[] = []
  for (const labelId of op.labelIds) {
    requireLabelRow(db, labelId)
    db.prepare(
      `INSERT INTO task_labels (task_id, label_id, updated_at, deleted_at)
       VALUES (?, ?, ?, NULL)
       ON CONFLICT (task_id, label_id) DO UPDATE SET updated_at = excluded.updated_at, deleted_at = NULL`
    ).run(op.id, labelId, now)
    const taskLabel = db
      .prepare('SELECT * FROM task_labels WHERE task_id = ? AND label_id = ?')
      .get(op.id, labelId) as TaskLabelRow
    taskLabels.push(taskLabel)
  }

  return { taskLabels }
}

function readReminderRow(db: Database, id: string): ReminderRow | undefined {
  return db.prepare('SELECT * FROM reminders WHERE id = ?').get(id) as ReminderRow | undefined
}

function requireReminderRow(db: Database, id: string): ReminderRow {
  const row = readReminderRow(db, id)
  if (!row || row.deleted_at !== null) throw new Error(`reminder not found: ${id}`)
  return row
}

function addReminder(db: Database, op: Extract<Op, { type: 'reminder.create' }>): ReminderRow {
  requireTaskRow(db, op.taskId)
  if (op.kind === 'relative' && op.minuteOffset === undefined) {
    throw new Error('relative reminders require minuteOffset')
  }
  if (op.kind === 'absolute' && op.at === undefined) {
    throw new Error('absolute reminders require at')
  }

  const now = nowIso()
  const id = nanoid(21)

  db.prepare(
    `INSERT INTO reminders (id, task_id, kind, minute_offset, at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, op.taskId, op.kind, op.minuteOffset ?? null, op.at ?? null, now)

  return requireReminderRow(db, id)
}

function updateReminder(db: Database, op: Extract<Op, { type: 'reminder.update' }>): ReminderRow {
  requireReminderRow(db, op.id)
  const now = nowIso()

  const fields: Array<[string, unknown]> = []
  if (op.kind !== undefined) fields.push(['kind', op.kind])
  if (op.minuteOffset !== undefined) fields.push(['minute_offset', op.minuteOffset])
  if (op.at !== undefined) fields.push(['at', op.at])
  // A timing change means the reminder hasn't fired for its new schedule yet.
  if (op.kind !== undefined || op.minuteOffset !== undefined || op.at !== undefined) {
    fields.push(['fired_at', null])
  }
  fields.push(['updated_at', now])

  const setClause = fields.map(([column]) => `${column} = ?`).join(', ')
  const values = fields.map(([, value]) => value)

  db.prepare(`UPDATE reminders SET ${setClause} WHERE id = ?`).run(...values, op.id)

  return requireReminderRow(db, op.id)
}

function deleteReminder(db: Database, op: Extract<Op, { type: 'reminder.delete' }>): ReminderRow {
  requireReminderRow(db, op.id)
  const now = nowIso()
  db.prepare('UPDATE reminders SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, op.id)

  const row = readReminderRow(db, op.id)
  if (!row) throw new Error(`reminder not found after delete: ${op.id}`)
  return row
}

function moveTask(db: Database, op: Extract<Op, { type: 'task.move' }>): TaskRow {
  const task = requireTaskRow(db, op.id)
  const now = nowIso()

  const targetProjectId = op.projectId ?? task.project_id
  const targetSectionId = op.sectionId !== undefined ? op.sectionId : task.section_id
  const targetParentId = op.parentId !== undefined ? op.parentId : task.parent_id

  if (op.projectId !== undefined) requireProjectRow(db, op.projectId)
  if (op.sectionId !== undefined && op.sectionId !== null) requireSectionRow(db, op.sectionId)

  if (op.parentId !== undefined && op.parentId !== null && op.parentId !== task.parent_id) {
    if (op.parentId === op.id) throw new Error('task cannot be its own parent')
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
  }

  const sameScope =
    targetProjectId === task.project_id &&
    targetSectionId === task.section_id &&
    targetParentId === task.parent_id

  if (sameScope) {
    const siblings = taskOrderScopeSiblings(db, task.project_id, task.section_id, task.parent_id)
    const assignments = planReorder(siblings, op.id, op.targetIndex)
    for (const assignment of assignments) {
      db.prepare('UPDATE tasks SET task_order = ?, updated_at = ? WHERE id = ?').run(
        assignment.key,
        now,
        assignment.id
      )
    }
  } else {
    const destSiblings = taskOrderScopeSiblings(db, targetProjectId, targetSectionId, targetParentId, op.id)
    const clampedIndex = Math.max(0, Math.min(op.targetIndex, destSiblings.length))
    const result = insertionKeys(
      destSiblings.map((sibling) => sibling.key),
      clampedIndex
    )

    if ('rebalanced' in result) {
      for (let i = 0; i < destSiblings.length; i++) {
        const finalIndex = i < clampedIndex ? i : i + 1
        db.prepare('UPDATE tasks SET task_order = ?, updated_at = ? WHERE id = ?').run(
          result.rebalanced[finalIndex],
          now,
          destSiblings[i].id
        )
      }
    }

    db.prepare(
      `UPDATE tasks SET project_id = ?, section_id = ?, parent_id = ?, task_order = ?, updated_at = ?
       WHERE id = ?`
    ).run(targetProjectId, targetSectionId, targetParentId, result.key, now, op.id)
  }

  return requireTaskRow(db, op.id)
}

function applyOp(db: Database, op: Op): MutateResult {
  switch (op.type) {
    case 'task.add': {
      const task = addTask(db, op)
      if (op.labels !== undefined && op.labels.length > 0) {
        const { labels, taskLabels } = attachTaskLabelsByName(db, task.id, op.labels)
        return { tasks: [task], labels, taskLabels }
      }
      return { tasks: [task] }
    }
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
    case 'task.setLabels': {
      const { taskLabels } = setTaskLabels(db, op)
      return { taskLabels }
    }
    case 'task.move':
      return { tasks: [moveTask(db, op)] }
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
    case 'label.add':
      return { labels: [addLabel(db, op)] }
    case 'label.update':
      return { labels: [updateLabel(db, op)] }
    case 'label.delete': {
      const { label, taskLabels } = deleteLabel(db, op)
      return { labels: [label], taskLabels }
    }
    case 'reminder.create':
      return { reminders: [addReminder(db, op)] }
    case 'reminder.update':
      return { reminders: [updateReminder(db, op)] }
    case 'reminder.delete':
      return { reminders: [deleteReminder(db, op)] }
    default: {
      const exhaustive: never = op
      throw new Error(`mutate: unknown op ${JSON.stringify(exhaustive)}`)
    }
  }
}

export function mutate(db: Database, op: Op): MutateResult {
  const validated = OpSchema.parse(op)
  const run = db.transaction((): MutateResult => applyOp(db, validated))
  const result = run()
  onMutated?.()
  return result
}

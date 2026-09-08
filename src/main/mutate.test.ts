import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from './db/open'
import { migrate } from './db/migrate'
import { mutate } from './mutate'
import { getProject, getTask, listProjects, listSections, listTasks } from './queries'


describe('mutate', () => {
  let db: Database

  beforeEach(() => {
    db = openDatabase(':memory:')
    migrate(db)
  })

  it('adds and lists a project', () => {
    const result = mutate(db, { type: 'project.add', name: 'Work' })
    const project = result.projects?.[0]
    expect(project?.name).toBe('Work')

    const projects = listProjects(db)
    expect(projects.map((p) => p.id)).toContain(project?.id)
  })

  it('adds a task into Inbox by default and round-trips it', () => {
    const result = mutate(db, { type: 'task.add', content: 'Buy milk' })
    const task = result.tasks?.[0]
    expect(task).toBeDefined()
    expect(task?.content).toBe('Buy milk')
    expect(task?.priority).toBe(4)
    expect(task?.added_at).toBeTruthy()
    expect(task?.updated_at).toBeTruthy()

    const inbox = getProject(db, task!.project_id)
    expect(inbox?.is_inbox).toBe(1)

    const fetched = getTask(db, task!.id)
    expect(fetched?.content).toBe('Buy milk')
  })

  it('updates task content and priority', () => {
    const added = mutate(db, { type: 'task.add', content: 'Draft' })
    const id = added.tasks![0].id

    const updated = mutate(db, { type: 'task.update', id, content: 'Draft v2', priority: 1 })
    expect(updated.tasks?.[0].content).toBe('Draft v2')
    expect(updated.tasks?.[0].priority).toBe(1)
  })

  it('tombstones a deleted task instead of removing the row', () => {
    const added = mutate(db, { type: 'task.add', content: 'Temp' })
    const id = added.tasks![0].id

    mutate(db, { type: 'task.delete', id })

    expect(getTask(db, id)).toBeUndefined()
    expect(listTasks(db).map((t) => t.id)).not.toContain(id)

    const raw = db.prepare('SELECT deleted_at FROM tasks WHERE id = ?').get(id) as
      | { deleted_at: string | null }
      | undefined
    expect(raw?.deleted_at).toBeTruthy()
  })

  it('tombstones a deleted project instead of removing the row', () => {
    const added = mutate(db, { type: 'project.add', name: 'Temp Project' })
    const id = added.projects![0].id

    mutate(db, { type: 'project.delete', id })

    expect(getProject(db, id)).toBeUndefined()
    expect(listProjects(db).map((p) => p.id)).not.toContain(id)

    const raw = db.prepare('SELECT deleted_at FROM projects WHERE id = ?').get(id) as
      | { deleted_at: string | null }
      | undefined
    expect(raw?.deleted_at).toBeTruthy()
  })

  it('completes a non-recurring task and appends exactly one completion', () => {
    const added = mutate(db, { type: 'task.add', content: 'Ship it' })
    const id = added.tasks![0].id

    const completed = mutate(db, { type: 'task.complete', id })
    expect(completed.tasks?.[0].checked).toBe(1)
    expect(completed.tasks?.[0].completed_at).toBeTruthy()

    const completions = db
      .prepare('SELECT * FROM completions WHERE task_id = ?')
      .all(id) as Array<{ task_id: string }>
    expect(completions).toHaveLength(1)
  })

  it('uncompletes a task, clearing checked state and removing the completion', () => {
    const added = mutate(db, { type: 'task.add', content: 'Ship it' })
    const id = added.tasks![0].id

    mutate(db, { type: 'task.complete', id })
    const uncompleted = mutate(db, { type: 'task.uncomplete', id })

    expect(uncompleted.tasks?.[0].checked).toBe(0)
    expect(uncompleted.tasks?.[0].completed_at).toBeNull()

    const completions = db
      .prepare('SELECT * FROM completions WHERE task_id = ?')
      .all(id) as Array<{ task_id: string }>
    expect(completions).toHaveLength(0)
  })

  it('uncompletes a never-completed task without throwing', () => {
    const added = mutate(db, { type: 'task.add', content: 'Never done' })
    const id = added.tasks![0].id

    const result = mutate(db, { type: 'task.uncomplete', id })

    expect(result.tasks?.[0].checked).toBe(0)
    expect(result.tasks?.[0].completed_at).toBeNull()
  })

  it('makes newly added task content searchable via task_fts', () => {
    mutate(db, { type: 'task.add', content: 'Search for the golden goose' })

    const hits = db
      .prepare("SELECT rowid FROM task_fts WHERE task_fts MATCH 'golden'")
      .all() as Array<{ rowid: number }>
    expect(hits.length).toBeGreaterThan(0)
  })

  it('archives and unarchives a project', () => {
    const added = mutate(db, { type: 'project.add', name: 'Work' })
    const id = added.projects![0].id

    const archived = mutate(db, { type: 'project.archive', id })
    expect(archived.projects?.[0].archived_at).toBeTruthy()

    const unarchived = mutate(db, { type: 'project.unarchive', id })
    expect(unarchived.projects?.[0].archived_at).toBeNull()
  })

  it('adds a section under a project and lists it', () => {
    const project = mutate(db, { type: 'project.add', name: 'Work' }).projects![0]

    const result = mutate(db, { type: 'section.add', projectId: project.id, name: 'To triage' })
    const section = result.sections?.[0]
    expect(section?.name).toBe('To triage')
    expect(section?.project_id).toBe(project.id)

    const sections = listSections(db, project.id)
    expect(sections.map((s) => s.id)).toContain(section?.id)
  })

  it('rejects adding a section to a nonexistent project', () => {
    expect(() =>
      mutate(db, { type: 'section.add', projectId: 'missing', name: 'Ghost' })
    ).toThrow()
  })

  it('updates a section name', () => {
    const project = mutate(db, { type: 'project.add', name: 'Work' }).projects![0]
    const section = mutate(db, {
      type: 'section.add',
      projectId: project.id,
      name: 'Draft'
    }).sections![0]

    const updated = mutate(db, { type: 'section.update', id: section.id, name: 'Final' })
    expect(updated.sections?.[0].name).toBe('Final')
  })

  it('tombstones a deleted section instead of removing the row', () => {
    const project = mutate(db, { type: 'project.add', name: 'Work' }).projects![0]
    const section = mutate(db, {
      type: 'section.add',
      projectId: project.id,
      name: 'Temp'
    }).sections![0]

    mutate(db, { type: 'section.delete', id: section.id })

    expect(listSections(db, project.id).map((s) => s.id)).not.toContain(section.id)

    const raw = db.prepare('SELECT deleted_at FROM sections WHERE id = ?').get(section.id) as
      | { deleted_at: string | null }
      | undefined
    expect(raw?.deleted_at).toBeTruthy()
  })

  it('archives and unarchives a section', () => {
    const project = mutate(db, { type: 'project.add', name: 'Work' }).projects![0]
    const section = mutate(db, {
      type: 'section.add',
      projectId: project.id,
      name: 'Someday'
    }).sections![0]

    const archived = mutate(db, { type: 'section.archive', id: section.id })
    expect(archived.sections?.[0].archived_at).toBeTruthy()
    // Archived sections stay live (not tombstoned) and still list.
    expect(listSections(db, project.id).map((s) => s.id)).toContain(section.id)

    const unarchived = mutate(db, { type: 'section.unarchive', id: section.id })
    expect(unarchived.sections?.[0].archived_at).toBeNull()
  })

  it('listSections filters by project and orders by section_order', () => {
    const projectA = mutate(db, { type: 'project.add', name: 'A' }).projects![0]
    const projectB = mutate(db, { type: 'project.add', name: 'B' }).projects![0]

    mutate(db, { type: 'section.add', projectId: projectA.id, name: 'A1' })
    mutate(db, { type: 'section.add', projectId: projectB.id, name: 'B1' })

    const sectionsA = listSections(db, projectA.id)
    expect(sectionsA).toHaveLength(1)
    expect(sectionsA[0].name).toBe('A1')

    const allSections = listSections(db)
    expect(allSections.length).toBeGreaterThanOrEqual(2)
  })
})

describe('recurring completions', () => {
  let db: Database

  beforeEach(() => {
    db = openDatabase(':memory:')
    migrate(db)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('advances due_date from the OLD due date, leaves checked=0, and appends exactly one completion', () => {
    const added = mutate(db, {
      type: 'task.add',
      content: 'Water plants',
      dueDate: '2026-01-15',
      dueHasTime: false,
      recurString: 'every day'
    })
    const id = added.tasks![0].id

    const completed = mutate(db, { type: 'task.complete', id })
    const task = completed.tasks![0]

    expect(task.due_date).toBe('2026-01-16')
    expect(task.checked).toBe(0)
    expect(task.completed_at).toBeNull()

    const completions = db.prepare('SELECT * FROM completions WHERE task_id = ?').all(id) as Array<{
      task_id: string
    }>
    expect(completions).toHaveLength(1)
  })

  it('every! (strict) recomputes the next due date from now, not from the old due date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 1, 10, 0, 0))

    const added = mutate(db, {
      type: 'task.add',
      content: 'Backup',
      dueDate: '2026-01-01',
      dueHasTime: false,
      recurString: 'every! 2 weeks',
      recurStrict: true
    })
    const id = added.tasks![0].id

    const completed = mutate(db, { type: 'task.complete', id })
    const task = completed.tasks![0]

    // base = now (2026-06-01), not the old due date (2026-01-01)
    expect(task.due_date).toBe('2026-06-15')
    expect(task.checked).toBe(0)
  })

  it('completes for good once a passed "ending" bound is reached', () => {
    const added = mutate(db, {
      type: 'task.add',
      content: 'Daily standup',
      dueDate: '2026-09-10',
      dueHasTime: false,
      recurString: 'every day ending 2026-09-10'
    })
    const id = added.tasks![0].id

    const completed = mutate(db, { type: 'task.complete', id })
    const task = completed.tasks![0]

    expect(task.checked).toBe(1)
    expect(task.completed_at).toBeTruthy()
    expect(task.due_date).toBe('2026-09-10')

    const completions = db.prepare('SELECT * FROM completions WHERE task_id = ?').all(id) as Array<{
      task_id: string
    }>
    expect(completions).toHaveLength(1)
  })

  it('never moves deadline_date when recomputing due_date', () => {
    const added = mutate(db, {
      type: 'task.add',
      content: 'File taxes',
      dueDate: '2026-03-01',
      dueHasTime: false,
      recurString: 'every month'
    })
    const id = added.tasks![0].id
    db.prepare('UPDATE tasks SET deadline_date = ? WHERE id = ?').run('2026-04-15', id)

    const completed = mutate(db, { type: 'task.complete', id })
    const task = completed.tasks![0]

    expect(task.due_date).toBe('2026-04-01')
    expect(task.deadline_date).toBe('2026-04-15')
  })

  it('falls back to normal completion for a corrupt recur_string', () => {
    const added = mutate(db, {
      type: 'task.add',
      content: 'Bad recur',
      dueDate: '2026-01-15',
      dueHasTime: false
    })
    const id = added.tasks![0].id
    db.prepare('UPDATE tasks SET recur_string = ? WHERE id = ?').run('not a real recur string', id)

    const completed = mutate(db, { type: 'task.complete', id })
    const task = completed.tasks![0]

    expect(task.checked).toBe(1)
    expect(task.completed_at).toBeTruthy()
  })

  it('leaves non-recurring completion behavior unchanged', () => {
    const added = mutate(db, {
      type: 'task.add',
      content: 'One-off',
      dueDate: '2026-01-15',
      dueHasTime: false
    })
    const id = added.tasks![0].id

    const completed = mutate(db, { type: 'task.complete', id })
    const task = completed.tasks![0]

    expect(task.checked).toBe(1)
    expect(task.completed_at).toBeTruthy()
    expect(task.due_date).toBe('2026-01-15')
  })
})

describe('subtasks', () => {
  let db: Database

  beforeEach(() => {
    db = openDatabase(':memory:')
    migrate(db)
  })

  it('task.add with parentId sets parent_id and inherits the parent\'s project_id and section_id even when a different projectId is passed', () => {
    const project = mutate(db, { type: 'project.add', name: 'Work' }).projects![0]
    const section = mutate(db, { type: 'section.add', projectId: project.id, name: 'To do' }).sections![0]
    
    const parent = mutate(db, { type: 'task.add', content: 'Parent task', projectId: project.id, sectionId: section.id }).tasks![0]
    
    const child = mutate(db, { type: 'task.add', content: 'Child task', projectId: 'different-project-id', parentId: parent.id }).tasks![0]
    
    expect(child.parent_id).toBe(parent.id)
    expect(child.project_id).toBe(project.id)
    expect(child.section_id).toBe(section.id)
  })

  it('task.add with a nonexistent parentId throws', () => {
    expect(() =>
      mutate(db, { type: 'task.add', content: 'Child task', parentId: 'nonexistent-id' })
    ).toThrow()
  })

  it('task.update setting parentId re-parents the task and inherits the parent\'s project_id; task.update with parentId: null clears parent_id', () => {
    const project = mutate(db, { type: 'project.add', name: 'Work' }).projects![0]
    const section = mutate(db, { type: 'section.add', projectId: project.id, name: 'To do' }).sections![0]
    
    const parent = mutate(db, { type: 'task.add', content: 'Parent task', projectId: project.id, sectionId: section.id }).tasks![0]
    const child = mutate(db, { type: 'task.add', content: 'Child task', projectId: project.id, sectionId: section.id }).tasks![0]
    
    // Reparent child to parent
    const updated = mutate(db, { type: 'task.update', id: child.id, parentId: parent.id })
    expect(updated.tasks![0].parent_id).toBe(parent.id)
    expect(updated.tasks![0].project_id).toBe(project.id)
    expect(updated.tasks![0].section_id).toBe(section.id)
    
    // Clear parent_id
    const cleared = mutate(db, { type: 'task.update', id: child.id, parentId: null })
    expect(cleared.tasks![0].parent_id).toBeNull()
  })

  it('task.update with parentId equal to the task\'s own id throws', () => {
    const parent = mutate(db, { type: 'task.add', content: 'Parent task' }).tasks![0]
    
    expect(() =>
      mutate(db, { type: 'task.update', id: parent.id, parentId: parent.id })
    ).toThrow('task cannot be its own parent')
  })

  it('Cycle: create a, then b with parentId a, then c with parentId b; task.update a with parentId c throws', () => {
    const a = mutate(db, { type: 'task.add', content: 'Task A' }).tasks![0]
    const b = mutate(db, { type: 'task.add', content: 'Task B', parentId: a.id }).tasks![0]
    const c = mutate(db, { type: 'task.add', content: 'Task C', parentId: b.id }).tasks![0]
    
    expect(() =>
      mutate(db, { type: 'task.update', id: a.id, parentId: c.id })
    ).toThrow('parent change would create a cycle')
  })

  it('Cascade delete: parent with child and grandchild - task.delete on the parent returns 3 tasks and all three rows have deleted_at set', () => {
    const project = mutate(db, { type: 'project.add', name: 'Work' }).projects![0]
    const section = mutate(db, { type: 'section.add', projectId: project.id, name: 'To do' }).sections![0]
    
    const a = mutate(db, { type: 'task.add', content: 'Task A', projectId: project.id, sectionId: section.id }).tasks![0]
    const b = mutate(db, { type: 'task.add', content: 'Task B', parentId: a.id }).tasks![0]
    const c = mutate(db, { type: 'task.add', content: 'Task C', parentId: b.id }).tasks![0]
    
    const deleted = mutate(db, { type: 'task.delete', id: a.id })
    
    expect(deleted.tasks).toHaveLength(3)
    
    // Check that all tasks have deleted_at set
    const aRow = db.prepare('SELECT deleted_at FROM tasks WHERE id = ?').get(a.id) as
      | { deleted_at: string | null }
      | undefined
    const bRow = db.prepare('SELECT deleted_at FROM tasks WHERE id = ?').get(b.id) as
      | { deleted_at: string | null }
      | undefined
    const cRow = db.prepare('SELECT deleted_at FROM tasks WHERE id = ?').get(c.id) as
      | { deleted_at: string | null }
      | undefined

    expect(aRow!.deleted_at).toBeTruthy()
    expect(bRow!.deleted_at).toBeTruthy()
    expect(cRow!.deleted_at).toBeTruthy()
  })

  it('Cascade undelete: after test-6-style delete, task.undelete on the parent restores all three (deleted_at null on each)', () => {
    const project = mutate(db, { type: 'project.add', name: 'Work' }).projects![0]
    const section = mutate(db, { type: 'section.add', projectId: project.id, name: 'To do' }).sections![0]
    
    const a = mutate(db, { type: 'task.add', content: 'Task A', projectId: project.id, sectionId: section.id }).tasks![0]
    const b = mutate(db, { type: 'task.add', content: 'Task B', parentId: a.id }).tasks![0]
    const c = mutate(db, { type: 'task.add', content: 'Task C', parentId: b.id }).tasks![0]
    
    // Delete parent
    mutate(db, { type: 'task.delete', id: a.id })
    
    // Undelete parent
    const undeleted = mutate(db, { type: 'task.undelete', id: a.id })
    
    expect(undeleted.tasks).toHaveLength(3)
    
    // Check that all tasks have deleted_at cleared
    const aRow = db.prepare('SELECT deleted_at FROM tasks WHERE id = ?').get(a.id) as
      | { deleted_at: string | null }
      | undefined
    const bRow = db.prepare('SELECT deleted_at FROM tasks WHERE id = ?').get(b.id) as
      | { deleted_at: string | null }
      | undefined
    const cRow = db.prepare('SELECT deleted_at FROM tasks WHERE id = ?').get(c.id) as
      | { deleted_at: string | null }
      | undefined

    expect(aRow!.deleted_at).toBeNull()
    expect(bRow!.deleted_at).toBeNull()
    expect(cRow!.deleted_at).toBeNull()
  })

  it('Independent completion: complete the parent; re-read the child via a task.update no-op or the returned rows - the child\'s checked stays 0', () => {
    const project = mutate(db, { type: 'project.add', name: 'Work' }).projects![0]
    const section = mutate(db, { type: 'section.add', projectId: project.id, name: 'To do' }).sections![0]
    
    const parent = mutate(db, { type: 'task.add', content: 'Parent task', projectId: project.id, sectionId: section.id }).tasks![0]
    const child = mutate(db, { type: 'task.add', content: 'Child task', parentId: parent.id }).tasks![0]
    
    // Complete parent
    mutate(db, { type: 'task.complete', id: parent.id })
    
    // Read child (should still be unchecked)
    const childAfter = getTask(db, child.id)
    expect(childAfter!.checked).toBe(0)
  })

  it('task.update with sectionId: null clears section_id on a task that had a section', () => {
    const project = mutate(db, { type: 'project.add', name: 'Work' }).projects![0]
    const section = mutate(db, { type: 'section.add', projectId: project.id, name: 'To do' }).sections![0]
    
    const task = mutate(db, { type: 'task.add', content: 'Task', projectId: project.id, sectionId: section.id }).tasks![0]
    
    const updated = mutate(db, { type: 'task.update', id: task.id, sectionId: null })
    expect(updated.tasks![0].section_id).toBeNull()
  })
})

describe('labels', () => {
  let db: Database

  beforeEach(() => {
    db = openDatabase(':memory:')
    migrate(db)
  })

  it('adds and lists a label', () => {
    const result = mutate(db, { type: 'label.add', name: 'urgent' })
    const label = result.labels?.[0]
    expect(label?.name).toBe('urgent')
    expect(label?.color).toBe('charcoal')
    expect(label?.is_favorite).toBe(0)
  })

  it('rejects adding a label with a name that already exists (live)', () => {
    mutate(db, { type: 'label.add', name: 'urgent' })
    expect(() => mutate(db, { type: 'label.add', name: 'urgent' })).toThrow()
  })

  it('updates a label name, color, and favorite flag', () => {
    const label = mutate(db, { type: 'label.add', name: 'urgent' }).labels![0]

    const updated = mutate(db, {
      type: 'label.update',
      id: label.id,
      name: 'urgent2',
      color: 'red',
      isFavorite: true
    })
    expect(updated.labels?.[0].name).toBe('urgent2')
    expect(updated.labels?.[0].color).toBe('red')
    expect(updated.labels?.[0].is_favorite).toBe(1)
  })

  it('tombstones a deleted label instead of removing the row and soft-deletes its task_labels rows', () => {
    const label = mutate(db, { type: 'label.add', name: 'urgent' }).labels![0]
    const task = mutate(db, { type: 'task.add', content: 'Task', labels: ['urgent'] }).tasks![0]

    const deleted = mutate(db, { type: 'label.delete', id: label.id })
    expect(deleted.labels?.[0].deleted_at).toBeTruthy()
    expect(deleted.taskLabels).toHaveLength(1)
    expect(deleted.taskLabels?.[0].deleted_at).toBeTruthy()

    const raw = db.prepare('SELECT deleted_at FROM labels WHERE id = ?').get(label.id) as
      | { deleted_at: string | null }
      | undefined
    expect(raw?.deleted_at).toBeTruthy()

    const taskLabelRaw = db
      .prepare('SELECT deleted_at FROM task_labels WHERE task_id = ? AND label_id = ?')
      .get(task.id, label.id) as { deleted_at: string | null } | undefined
    expect(taskLabelRaw?.deleted_at).toBeTruthy()
  })

  it('reviving a soft-deleted label name: deleting then re-adding a label with the same name revives the row instead of throwing', () => {
    const label = mutate(db, { type: 'label.add', name: 'urgent' }).labels![0]
    mutate(db, { type: 'label.delete', id: label.id })

    const revived = mutate(db, { type: 'label.add', name: 'urgent', color: 'blue' }).labels![0]
    expect(revived.id).toBe(label.id)
    expect(revived.deleted_at).toBeNull()
    expect(revived.color).toBe('blue')
  })

  it('task.setLabels replaces the full label set for a task', () => {
    const labelA = mutate(db, { type: 'label.add', name: 'a' }).labels![0]
    const labelB = mutate(db, { type: 'label.add', name: 'b' }).labels![0]
    const labelC = mutate(db, { type: 'label.add', name: 'c' }).labels![0]
    const task = mutate(db, { type: 'task.add', content: 'Task' }).tasks![0]

    mutate(db, { type: 'task.setLabels', id: task.id, labelIds: [labelA.id, labelB.id] })
    const replaced = mutate(db, { type: 'task.setLabels', id: task.id, labelIds: [labelB.id, labelC.id] })

    const liveLabelIds = replaced.taskLabels?.map((tl) => tl.label_id).sort()
    expect(liveLabelIds).toEqual([labelB.id, labelC.id].sort())

    const allRows = db
      .prepare('SELECT label_id, deleted_at FROM task_labels WHERE task_id = ?')
      .all(task.id) as Array<{ label_id: string; deleted_at: string | null }>
    const aRow = allRows.find((r) => r.label_id === labelA.id)
    const bRow = allRows.find((r) => r.label_id === labelB.id)
    const cRow = allRows.find((r) => r.label_id === labelC.id)
    expect(aRow?.deleted_at).toBeTruthy()
    expect(bRow?.deleted_at).toBeNull()
    expect(cRow?.deleted_at).toBeNull()
  })

  it('task.setLabels rejects an unknown label id', () => {
    const task = mutate(db, { type: 'task.add', content: 'Task' }).tasks![0]
    expect(() =>
      mutate(db, { type: 'task.setLabels', id: task.id, labelIds: ['missing-label'] })
    ).toThrow()
  })

  it('task.add with labels finds-or-creates labels by case-insensitive name and reuses existing ones', () => {
    const existing = mutate(db, { type: 'label.add', name: 'Urgent' }).labels![0]

    const result = mutate(db, {
      type: 'task.add',
      content: 'Task',
      labels: ['urgent', 'new-label']
    })

    expect(result.labels).toHaveLength(2)
    const urgentLabel = result.labels?.find((l) => l.id === existing.id)
    expect(urgentLabel).toBeDefined()
    const newLabel = result.labels?.find((l) => l.name === 'new-label')
    expect(newLabel).toBeDefined()

    const taskLabelIds = result.taskLabels?.map((tl) => tl.label_id).sort()
    expect(taskLabelIds).toEqual([existing.id, newLabel!.id].sort())

    // No duplicate label was created for the case-insensitive match.
    const allLabels = db.prepare('SELECT id FROM labels WHERE name = ? COLLATE NOCASE').all('urgent') as Array<{
      id: string
    }>
    expect(allLabels).toHaveLength(1)
  })
})

describe('task ordering', () => {
  let db: Database

  beforeEach(() => {
    db = openDatabase(':memory:')
    migrate(db)
  })

  it('task.add assigns sparse, increasing task_order values within a scope', () => {
    const t1 = mutate(db, { type: 'task.add', content: 'One' }).tasks![0]
    const t2 = mutate(db, { type: 'task.add', content: 'Two' }).tasks![0]
    const t3 = mutate(db, { type: 'task.add', content: 'Three' }).tasks![0]

    expect(t1.task_order).toBe(1024)
    expect(t2.task_order).toBe(2048)
    expect(t3.task_order).toBe(3072)
  })

  it('same-scope move updates only the moved row and listTasks reflects the new order', () => {
    const project = mutate(db, { type: 'project.add', name: 'Work' }).projects![0]
    const t1 = mutate(db, { type: 'task.add', content: 'One', projectId: project.id }).tasks![0]
    const t2 = mutate(db, { type: 'task.add', content: 'Two', projectId: project.id }).tasks![0]
    const t3 = mutate(db, { type: 'task.add', content: 'Three', projectId: project.id }).tasks![0]

    // Move the head task to the tail; the tail has unbounded room so this is
    // a single-key update, not a rebalance.
    const moved = mutate(db, { type: 'task.move', id: t1.id, targetIndex: 2 })
    expect(moved.tasks?.[0].id).toBe(t1.id)

    const ordered = listTasks(db, project.id)
    expect(ordered.map((t) => t.id)).toEqual([t2.id, t3.id, t1.id])

    // t2 and t3 kept their original keys - only t1's row changed.
    expect(ordered.find((t) => t.id === t2.id)!.task_order).toBe(2048)
    expect(ordered.find((t) => t.id === t3.id)!.task_order).toBe(3072)
  })

  it('moving into a scope with equal legacy task_order values triggers a rebalance with strictly increasing keys', () => {
    const project = mutate(db, { type: 'project.add', name: 'Legacy' }).projects![0]
    const t1 = mutate(db, { type: 'task.add', content: 'One', projectId: project.id }).tasks![0]
    const t2 = mutate(db, { type: 'task.add', content: 'Two', projectId: project.id }).tasks![0]
    const t3 = mutate(db, { type: 'task.add', content: 'Three', projectId: project.id }).tasks![0]

    // Simulate legacy rows where task_order was never assigned (all zero),
    // with added_at still reflecting creation order.
    db.prepare('UPDATE tasks SET task_order = 0, added_at = ? WHERE id = ?').run(
      '2024-01-01T00:00:00.000Z',
      t1.id
    )
    db.prepare('UPDATE tasks SET task_order = 0, added_at = ? WHERE id = ?').run(
      '2024-01-01T00:00:01.000Z',
      t2.id
    )
    db.prepare('UPDATE tasks SET task_order = 0, added_at = ? WHERE id = ?').run(
      '2024-01-01T00:00:02.000Z',
      t3.id
    )

    // Move t3 (currently last, by added_at) to the head; equal keys leave no
    // room for keyBetween, forcing a full rebalance of the scope.
    mutate(db, { type: 'task.move', id: t3.id, targetIndex: 0 })

    const ordered = listTasks(db, project.id)
    expect(ordered.map((t) => t.id)).toEqual([t3.id, t1.id, t2.id])
    expect(ordered[0].task_order).toBeLessThan(ordered[1].task_order)
    expect(ordered[1].task_order).toBeLessThan(ordered[2].task_order)
  })

  it('cross-scope move re-parents the task to the destination section and lands at the requested index', () => {
    const project = mutate(db, { type: 'project.add', name: 'Work' }).projects![0]
    const sectionA = mutate(db, { type: 'section.add', projectId: project.id, name: 'A' }).sections![0]
    const sectionB = mutate(db, { type: 'section.add', projectId: project.id, name: 'B' }).sections![0]

    const x = mutate(db, {
      type: 'task.add',
      content: 'X',
      projectId: project.id,
      sectionId: sectionA.id
    }).tasks![0]
    const b1 = mutate(db, {
      type: 'task.add',
      content: 'B1',
      projectId: project.id,
      sectionId: sectionB.id
    }).tasks![0]
    const b2 = mutate(db, {
      type: 'task.add',
      content: 'B2',
      projectId: project.id,
      sectionId: sectionB.id
    }).tasks![0]

    const moved = mutate(db, { type: 'task.move', id: x.id, targetIndex: 1, sectionId: sectionB.id })
    expect(moved.tasks?.[0].section_id).toBe(sectionB.id)

    const sectionBTasks = listTasks(db, project.id).filter((t) => t.section_id === sectionB.id)
    expect(sectionBTasks.map((t) => t.id)).toEqual([b1.id, x.id, b2.id])
  })

  it('task.move with an unknown id throws', () => {
    expect(() => mutate(db, { type: 'task.move', id: 'missing', targetIndex: 0 })).toThrow()
  })
})

describe('reminders', () => {
  let db: Database

  beforeEach(() => {
    db = openDatabase(':memory:')
    migrate(db)
  })

  it('creates a relative reminder', () => {
    const task = mutate(db, { type: 'task.add', content: 'Ship it' }).tasks![0]

    const result = mutate(db, {
      type: 'reminder.create',
      taskId: task.id,
      kind: 'relative',
      minuteOffset: 30
    })

    const reminder = result.reminders?.[0]
    expect(reminder?.task_id).toBe(task.id)
    expect(reminder?.kind).toBe('relative')
    expect(reminder?.minute_offset).toBe(30)
    expect(reminder?.at).toBeNull()
    expect(reminder?.fired_at).toBeNull()
  })

  it('creates an absolute reminder', () => {
    const task = mutate(db, { type: 'task.add', content: 'Ship it' }).tasks![0]

    const result = mutate(db, {
      type: 'reminder.create',
      taskId: task.id,
      kind: 'absolute',
      at: '2026-01-01 09:00'
    })

    const reminder = result.reminders?.[0]
    expect(reminder?.kind).toBe('absolute')
    expect(reminder?.at).toBe('2026-01-01 09:00')
    expect(reminder?.minute_offset).toBeNull()
  })

  it('rejects a relative reminder without minuteOffset', () => {
    const task = mutate(db, { type: 'task.add', content: 'Ship it' }).tasks![0]

    expect(() =>
      mutate(db, { type: 'reminder.create', taskId: task.id, kind: 'relative' })
    ).toThrow()
  })

  it('rejects an absolute reminder without at', () => {
    const task = mutate(db, { type: 'task.add', content: 'Ship it' }).tasks![0]

    expect(() =>
      mutate(db, { type: 'reminder.create', taskId: task.id, kind: 'absolute' })
    ).toThrow()
  })

  it('rejects creating a reminder on a nonexistent task', () => {
    expect(() =>
      mutate(db, { type: 'reminder.create', taskId: 'missing', kind: 'relative', minuteOffset: 10 })
    ).toThrow()
  })

  it('updates a reminder and clears fired_at when the timing changes', () => {
    const task = mutate(db, { type: 'task.add', content: 'Ship it' }).tasks![0]
    const created = mutate(db, {
      type: 'reminder.create',
      taskId: task.id,
      kind: 'absolute',
      at: '2026-01-01 09:00'
    }).reminders![0]

    db.prepare('UPDATE reminders SET fired_at = ? WHERE id = ?').run('2026-01-01T09:00:00.000Z', created.id)

    const updated = mutate(db, { type: 'reminder.update', id: created.id, at: '2026-01-02 09:00' })

    expect(updated.reminders?.[0].at).toBe('2026-01-02 09:00')
    expect(updated.reminders?.[0].fired_at).toBeNull()
  })

  it('tombstones a deleted reminder instead of removing the row', () => {
    const task = mutate(db, { type: 'task.add', content: 'Ship it' }).tasks![0]
    const created = mutate(db, {
      type: 'reminder.create',
      taskId: task.id,
      kind: 'relative',
      minuteOffset: 15
    }).reminders![0]

    const deleted = mutate(db, { type: 'reminder.delete', id: created.id })
    expect(deleted.reminders?.[0].deleted_at).toBeTruthy()

    const raw = db.prepare('SELECT deleted_at FROM reminders WHERE id = ?').get(created.id) as {
      deleted_at: string | null
    }
    expect(raw.deleted_at).toBeTruthy()
  })

  it('reminder.update on an unknown id throws', () => {
    expect(() => mutate(db, { type: 'reminder.update', id: 'missing', minuteOffset: 5 })).toThrow()
  })

  it('reminder.delete on an unknown id throws', () => {
    expect(() => mutate(db, { type: 'reminder.delete', id: 'missing' })).toThrow()
  })
})

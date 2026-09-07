import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from './db/open'
import { migrate } from './db/migrate'
import { mutate } from './mutate'
import { getProject, getTask, listProjects, listSections, listTasks } from './queries'
import { readTaskRow } from './mutate'

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

describe('subtasks', () => {
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
    const aRow = readTaskRow(db, a.id)
    const bRow = readTaskRow(db, b.id)
    const cRow = readTaskRow(db, c.id)
    
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
    const aRow = readTaskRow(db, a.id)
    const bRow = readTaskRow(db, b.id)
    const cRow = readTaskRow(db, c.id)
    
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

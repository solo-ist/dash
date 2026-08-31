import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from './db/open'
import { migrate } from './db/migrate'
import { mutate } from './mutate'
import { getProject, getTask, listProjects, listTasks } from './queries'

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

  it('makes newly added task content searchable via task_fts', () => {
    mutate(db, { type: 'task.add', content: 'Search for the golden goose' })

    const hits = db
      .prepare("SELECT rowid FROM task_fts WHERE task_fts MATCH 'golden'")
      .all() as Array<{ rowid: number }>
    expect(hits.length).toBeGreaterThan(0)
  })
})

import { describe, expect, it } from 'vitest'
import { openDatabase } from './open'
import { migrate } from './migrate'

describe('migrate', () => {
  it('applies all migrations and sets user_version to the latest version', () => {
    const db = openDatabase(':memory:')
    migrate(db)

    expect(db.pragma('user_version', { simple: true })).toBe(2)

    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{
        name: string
      }>
    ).map((row) => row.name)

    for (const expected of [
      'projects',
      'sections',
      'tasks',
      'labels',
      'task_labels',
      'reminders',
      'filters',
      'comments',
      'completions',
      'task_fts'
    ]) {
      expect(tables).toContain(expected)
    }

    db.close()
  })

  it('is idempotent when run again', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    expect(() => migrate(db)).not.toThrow()
    expect(db.pragma('user_version', { simple: true })).toBe(2)
    db.close()
  })

  it('adds the reminders.fired_at column', () => {
    const db = openDatabase(':memory:')
    migrate(db)

    const columns = (
      db.prepare('PRAGMA table_info(reminders)').all() as Array<{ name: string }>
    ).map((row) => row.name)
    expect(columns).toContain('fired_at')

    db.close()
  })
})

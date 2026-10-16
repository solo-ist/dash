import { describe, expect, it } from 'vitest'
import { openDatabase } from './open'
import { migrate } from './migrate'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('migrate', () => {
  it('applies all migrations and sets user_version to the latest version', () => {
    const db = openDatabase(':memory:')
    migrate(db)

    expect(db.pragma('user_version', { simple: true })).toBe(2)

    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ").all() as Array<{
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

  it('backs up a file-backed db before migrating', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dash-migrate-'))
    const dbPath = join(dir, 'dash.db')

    const db = openDatabase(dbPath)
    db.exec('PRAGMA user_version = 0')
    db.close()

    const db2 = openDatabase(dbPath)
    migrate(db2)

    const backupPath = `${dbPath}.bak-0`
    expect(existsSync(backupPath)).toBe(true)

    const backupDb = openDatabase(backupPath)
    expect(backupDb.pragma('user_version', { simple: true })).toBe(0)
    backupDb.close()

    expect(db2.pragma('user_version', { simple: true })).toBe(2)

    db2.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('backup includes committed writes that were still in the WAL sidecar', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dash-migrate-'))
    const dbPath = join(dir, 'dash.db')

    const db = openDatabase(dbPath)
    db.exec('CREATE TABLE pre_existing (id INTEGER PRIMARY KEY, note TEXT)')
    db.prepare('INSERT INTO pre_existing (note) VALUES (?)').run('in the wal')
    // The commit above lives in dash.db-wal until a checkpoint; migrate must
    // checkpoint before copying or the backup silently loses it.
    migrate(db)
    db.close()

    const backupDb = openDatabase(`${dbPath}.bak-0`)
    const row = backupDb.prepare('SELECT note FROM pre_existing').get() as { note: string }
    expect(row.note).toBe('in the wal')
    expect(backupDb.pragma('user_version', { simple: true })).toBe(0)
    backupDb.close()

    rmSync(dir, { recursive: true, force: true })
  })

  it('overwrites a stale same-version backup', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dash-migrate-'))
    const dbPath = join(dir, 'dash.db')

    const db = openDatabase(dbPath)
    db.exec('PRAGMA user_version = 0')
    db.close()

    const backupPath = `${dbPath}.bak-0`
    writeFileSync(backupPath, 'stale non-sqlite content')

    const db2 = openDatabase(dbPath)
    migrate(db2)
    db2.close()

    // copyFileSync clobbers: the stale file is now a valid pre-upgrade snapshot
    const backupDb = openDatabase(backupPath)
    expect(backupDb.pragma('user_version', { simple: true })).toBe(0)
    backupDb.close()

    rmSync(dir, { recursive: true, force: true })
  })

  it(':memory: skips the backup', () => {
    const db = openDatabase(':memory:')
    expect(() => migrate(db)).not.toThrow()
    expect(existsSync(':memory:.bak-0')).toBe(false)
    db.close()
  })
})

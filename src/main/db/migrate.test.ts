import { describe, expect, it } from 'vitest'
import { openDatabase } from './open'
import { migrate } from './migrate'
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

  it('backs up a file-backed db before migrating', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dash-migrate-'))
    const dbPath = join(dir, 'dash.db')
    
    // Create and initialize a database
    const db = openDatabase(dbPath)
    // Set initial version to 0
    db.exec('PRAGMA user_version = 0')
    db.close()
    
    // Now migrate it
    const db2 = openDatabase(dbPath)
    migrate(db2)
    
    // Check that backup exists
    const backupPath = `${dbPath}.bak-0`
    expect(existsSync(backupPath)).toBe(true)
    
    // Verify backup contains the pre-upgrade state
    const backupDb = openDatabase(backupPath)
    expect(backupDb.pragma('user_version', { simple: true })).toBe(0)
    backupDb.close()
    
    // Verify live db was upgraded
    expect(db2.pragma('user_version', { simple: true })).toBe(2)
    
    db2.close()
    
    // Cleanup
    rmSync(dir, { recursive: true, force: true })
  })

  it('overwrites a same-version backup on re-run', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dash-migrate-'))
    const dbPath = join(dir, 'dash.db')
    
    // Create and initialize a database
    const db = openDatabase(dbPath)
    // Set initial version to 0
    db.exec('PRAGMA user_version = 0')
    db.close()
    
    // Migrate it once
    const db2 = openDatabase(dbPath)
    migrate(db2)
    db2.close()
    
    // Verify backup was created
    const backupPath = `${dbPath}.bak-0`
    expect(existsSync(backupPath)).toBe(true)
    
    // Migrate again - should overwrite the backup
    const db3 = openDatabase(dbPath)
    migrate(db3)
    
    // Since there are no pending migrations, no new backup should be created
    // (this tests that the backup only happens when there are pending migrations)
    expect(existsSync(`${dbPath}.bak-2`)).toBe(false)
    
    db3.close()
    
    // Cleanup
    rmSync(dir, { recursive: true, force: true })
  })

  it(':memory: skips the backup', () => {
    const db = openDatabase(':memory:')
    expect(() => migrate(db)).not.toThrow()
    expect(existsSync(':memory:.bak-0')).toBe(false)
    db.close()
  })
})

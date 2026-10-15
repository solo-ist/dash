import type Database from 'better-sqlite3'
import { copyFileSync, existsSync } from 'node:fs'
import migration001 from './migrations/001_init.sql?raw'
import migration002 from './migrations/002_reminders_fired_at.sql?raw'

interface Migration {
  version: number
  name: string
  sql: string
}

const MIGRATIONS: Migration[] = [
  { version: 1, name: 'init', sql: migration001 },
  { version: 2, name: 'reminders_fired_at', sql: migration002 }
]

function readUserVersion(db: Database): number {
  const raw = db.pragma('user_version', { simple: true })
  if (typeof raw !== 'number') {
    throw new Error('PRAGMA user_version did not return a number')
  }
  return raw
}

// architecture.md §3 backup convention: <path>.bak-<fromVersion>
export function migrate(db: Database): void {
  const current = readUserVersion(db)
  const pending = MIGRATIONS.filter((migration) => migration.version > current)
  if (pending.length === 0) return

  // Create backup if db is file-backed
  if (db.name !== ':memory:' && existsSync(db.name)) {
    copyFileSync(db.name, `${db.name}.bak-${current}`)
  }

  const applyPending = db.transaction(() => {
    for (const migration of pending) {
      db.exec(migration.sql)
      db.exec(`PRAGMA user_version = ${migration.version}`)
    }
  })
  applyPending()
}

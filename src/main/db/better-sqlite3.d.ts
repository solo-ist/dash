declare module 'better-sqlite3' {
  export interface RunResult {
    changes: number
    lastInsertRowid: number | bigint
  }

  export interface Statement {
    run(...params: unknown[]): RunResult
    get(...params: unknown[]): unknown
    all(...params: unknown[]): unknown[]
  }

  export default class Database {
    constructor(filename: string, options?: object)
    exec(sql: string): this
    prepare(sql: string): Statement
    pragma(sql: string, opts?: { simple?: boolean }): unknown
    transaction<F extends (...args: never[]) => unknown>(fn: F): F
    close(): void
  }
}

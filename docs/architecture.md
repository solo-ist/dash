# Dash architecture

The load-bearing spec. Every issue/mission builds inside this; agents deviate
only when their task prompt explicitly says so. Scope: `docs/scope.md`. Data
ground truth: `docs/research/`. Design rules: `AGENTS.md`.

## 1. Process model

```
┌─ main (Node) ──────────────────────────────────────────────┐
│ SQLite (better-sqlite3, WAL) · migrations · mutation layer │
│ reminder scheduler · native menu · window mgmt             │
│ [M4] tray · global shortcuts · dash:// · quick-add window  │
└──────────────┬─────────────────────────────────────────────┘
               │ typed IPC (invoke/handle, zod-validated)
┌─ preload (CJS, sandboxed) ─────────────────────────────────┐
│ window.api = { query, mutate, on }  — the ONLY bridge      │
└──────────────┬─────────────────────────────────────────────┘
┌─ renderer (React) ─────────────────────────────────────────┐
│ Zustand stores (optimistic) · views · quick-add UI         │
└────────────────────────────────────────────────────────────┘
shared/ (imported by all three): types · quickadd parser · recur engine · zod schemas
```

Security invariants (never change): `sandbox: true`, `contextIsolation: true`,
`nodeIntegration: false`. Renderer never touches Node/DB directly.

## 2. Directory layout

```
src/main/        index.ts (window/app) · db/{open,migrate}.ts · db/migrations/NNN_*.sql
                 mutate.ts (mutation layer) · queries.ts · ipc.ts · reminders.ts
                 [M4] tray.ts · shortcuts.ts · deeplinks.ts · quickAddWindow.ts
src/preload/     index.ts (window.api bridge only)
src/renderer/    App.tsx · components/{ui,layout,tasks,quickadd,views}/
                 stores/{taskStore,projectStore,uiStore}.ts · lib/
src/shared/      types.ts · ops.ts (zod) · queries.ts (zod) · quickadd/ · recur/
e2e/             Playwright (electron-playwright-helpers)
```

## 3. Storage (main process)

- **better-sqlite3**, WAL, synchronous API (fast, transactional; main-process
  only). DB file: `app.getPath('userData')/dash.db`.
- Schema v0 = `docs/research/data-model.md` **plus sync primitives on every
  entity table**: `id TEXT PK` (nanoid 21), `updated_at TEXT NOT NULL`
  (UTC ISO), `deleted_at TEXT` (tombstone; all read queries filter
  `deleted_at IS NULL`). `completions` is append-only (no tombstone).
- **Migrations**: `src/main/db/migrations/NNN_name.sql`, applied in a
  transaction at startup; `PRAGMA user_version` tracks position. No down
  migrations (local-first, forward-only; DB backed up to
  `dash.db.bak-<version>` before each migration batch).
- **Dates**: stored as *local wall time* ISO strings without offset
  (`2026-11-11T16:00:00` or date-only `2026-11-11`) + `due_has_time` flag —
  Todoist's model; wall time survives timezone travel. `updated_at`/
  `completed_at`/`added_at` are UTC ISO (instants, not wall time).
- **FTS**: `task_fts` (fts5, external content) maintained by triggers created
  in the same migration as `tasks`.

## 4. Mutation layer — the single write path

All writes — IPC, importer, future sync — go through one function:

```ts
// src/main/mutate.ts
mutate(op: Op): MutateResult   // applies in one transaction, stamps updated_at
```

`Op` is a zod-validated discriminated union in `src/shared/ops.ts`:
`task.add | task.update | task.complete | task.uncomplete | task.delete |
task.move | project.add | project.update | project.archive | project.delete |
section.* | label.* | filter.* | reminder.* | comment.*` (grow per milestone).

Rules:
- `task.complete` on a recurring task: append `completions` row, recompute next
  due via the recur engine (base = old due, or now when `recur_strict`), past
  `recur_ends` → mark checked. Non-recurring: `checked=1, completed_at`.
- `*.delete` = tombstone (`deleted_at`), never `DELETE` (except internal
  cleanup jobs later). Undo = clear the tombstone within the session.
- Every mutation returns the changed rows; `ipc.ts` broadcasts
  `data:changed {entities}` to all windows so stores can reconcile.
- **Why**: this is the "sync-friendly primitives" posture — a future sync
  engine records/replays `Op`s; nothing else in the app needs to change.

## 5. IPC contract

Two generic channels + one event, all zod-validated in `src/main/ipc.ts`:

```ts
window.api.query<Name extends QueryName>(name, params) // db:query — read-only
window.api.mutate(op: Op)                              // db:mutate
window.api.on('data:changed', cb)                      // push after any mutation
```

Queries are named + typed in `src/shared/queries.ts` (`tasks.byProject`,
`tasks.today`, `tasks.upcoming`, `projects.all`, `search.tasks`, …) and
implemented with prepared statements in `src/main/queries.ts`. No ad-hoc SQL
over IPC, ever. Adding a query/op = shared schema + main implementation; the
preload bridge stays untouched (it's generic).

## 6. Renderer state

- `projectStore`: projects+sections tree, ordering. `taskStore`: tasks keyed by
  id + per-view id lists. `uiStore`: selection, open panels, quick-add state.
- **Optimistic writes**: store applies expected result → `api.mutate` →
  reconcile from returned rows (rollback on error, bespoke notification on
  failure per AGENTS.md — no toast lib).
- `data:changed` triggers targeted re-query of affected views only.
- Stores take `api` by injection (unit-testable without Electron).

## 7. Quick-add parser (`src/shared/quickadd/`)

Pure module, zero DOM/Node deps:

```ts
parse(input: string, ctx: {projects, labels}): {
  content: string            // input minus consumed spans
  due?: {date, hasTime}      // one-shot
  recur?: RecurRule          // parsed recurrence (see §8)
  priority?: 1|2|3|4
  projectRef?, labelRefs[], duration?: minutes
  spans: Span[]              // {start,end,kind} over the ORIGINAL string → chips
}
```

- Tokenizer scans for `#project`/`@label` (resolved fuzzily against ctx, kept
  as plain text when unresolved), `p1..p4`, durations (`30m|2h|2h30m`), and NL
  dates/recurrence.
- **Recurrence outranks one-shot dates** in the same input (probe finding);
  time-of-day binds to the recurrence when both present.
- Aliases canonicalize at parse (`morning→9am`, `workday→Mon–Fri`,
  `until X → ending X`).
- The 12 probe cases in `docs/research/mcp-ground-truth.md` are the fixture
  baseline; parser tests must cover all of them.
- UI renders `spans` as live chips over an editable input (M0 issue #7).

## 8. Recurrence engine (`src/shared/recur/`)

```ts
parseRecur(s: string): RecurRule | null     // canonical-string grammar
formatRecur(rule): string                    // canonical string (round-trips)
nextOccurrence(rule, base: WallDateTime): WallDateTime | null  // null = past end
```

`RecurRule`: `{freq: day|week|month|year|hour, interval, byWeekday?: number[],
byMonthDay?: number|'last', byMonth?, nthWeekday?: {nth, weekday}, at?: {h,m},
strict: boolean, ends?: date}`. Storage: tasks keep the **canonical string**
(source of truth, human-visible) — `parseRecur` is deterministic, so no
serialized rule column. Completion semantics per §4. Grammar subset per
`docs/scope.md`; anything unparseable stays a plain (non-recurring) task.

## 9. Views & filters

- M0–M2 views (project list, Today, Upcoming) are **named SQL queries** (§5),
  sorted: manual `task_order` within sections; date views by
  `(due, priority, task_order)`.
- M3 filter engine: `src/shared/filterlang/` compiles the query grammar
  (`p1..p4, overdue, no date, N days, due after:, #proj, /section, @label,
  ! & | ()`) to an AST → `src/main/` renders AST to a SQL WHERE with bound
  params (no string interpolation). Saved filters store the query text; the
  sidebar runs them like any named query.
- Board view = same data, grouped by `section_id`; drag writes
  `task.move {sectionId, order}` ops.

## 10. Reminders (M2)

Main-process scheduler (`src/main/reminders.ts`): on startup + after any
mutation touching due/reminders, compute next 24h of firings (relative =
due − offset; absolute as-is), arm one `setTimeout` for the nearest, re-arm on
fire/wake (`powerMonitor` resume). Fire = Electron `Notification` with
Complete / Snooze actions → ops through §4. Missed-while-asleep firings fire
once on resume.

## 11. Desktop shell (M4 interfaces, stubbed till then)

- Tray: rebuilt from `tasks.today` query on `data:changed`.
- Global shortcuts: registered in main, stored in settings JSON
  (`userData/settings.json`, Prose pattern).
- `dash://` endpoints: `today | project/<id> | task/<id> | quick-add?text=` —
  same handlers the quick-add window and deep links share.
- Quick-add window: separate frameless BrowserWindow loading the same renderer
  with `#quick-add` route; shares parser/stores code, talks over the same IPC.

## 12. Testing

- **Unit (vitest)**: shared modules (parser, recur, filterlang) exhaustively;
  mutation layer + queries against in-memory SQLite; stores with injected api.
  `npm test`.
- **e2e (Playwright)**: launch built app, real user flows (issue #9 defines
  M0's). `npm run test:e2e`.
- Every mission's verification = `npm run typecheck && npm test` minimum;
  e2e for renderer-visible changes.

## 13. Dependencies policy

M0 adds: `better-sqlite3`, `nanoid`, `zod`, `vitest` (dev). Anything further
needs an issue that says so. Dependency/lockfile changes are
orchestrator-only (AGENTS.md).

# 01 — Architecture decisions

Full contracts (interfaces, schema, directory layout): `docs/architecture.md`.
This doc is the decision list with the *why* a naive rebuild would miss.
Schema v0 detail: `docs/research/data-model.md` (implemented in
`src/main/db/migrations/001_init.sql`).

## Process & security model

- **Electron ^40, three-world split**: main owns SQLite + OS integration;
  renderer is a sandboxed React app; preload exposes a *generic* typed bridge.
  Invariants (never change): `sandbox: true`, `contextIsolation: true`,
  `nodeIntegration: false`.
- **The IPC surface never grows per-feature.** Exactly three channels:
  `query(name, params)`, `mutate(op)`, and a `data:changed` event. Features add
  named queries and Op variants in `src/shared/`, not new channels. Why: keeps
  the preload bridge auditable and stops the sandbox boundary eroding one
  convenience channel at a time.

## Data

- **better-sqlite3 in the main process, WAL, foreign_keys ON.** Synchronous API
  is a feature: every mutation is a single transaction, no async races.
- **One write path.** Every write — UI, importer, future sync — goes through
  `mutate(op)` with a zod-validated discriminated-union `Op`
  (`src/shared/ops.ts` → `src/main/mutate.ts`). Why: this is the
  sync-friendliness bet from `docs/scope.md` made concrete; a future sync
  engine records/replays Ops with nothing else changing. No op-log in v1.
- **Sync-friendly primitives on every entity row**: nanoid ids, `updated_at`
  (UTC ISO) on every write, `deleted_at` tombstones instead of hard deletes;
  live queries filter `deleted_at IS NULL`. `completions` is append-only
  history and deliberately has neither.
- **Dates are local wall-time strings** (`YYYY-MM-DD` or
  `YYYY-MM-DDTHH:MM:SS`, no zone) plus a `due_has_time` flag — the Todoist
  model. Why: a recurring "6pm garbage night" must survive timezone travel;
  UTC-instant storage breaks it. Instants (`updated_at`, `completed_at`) are
  UTC ISO.
- **Migrations**: numbered SQL files, `PRAGMA user_version`, forward-only, each
  batch in a transaction, file backup before migrating (backup deferred while
  M0 runs in-memory). **FTS5 external-content** table on tasks kept in sync by
  triggers.

## Engines (pure, main-agnostic, exhaustively unit-tested)

- **Quick-add parser** (`src/shared/quickadd/`): pure function
  `parse(text, {now}) → {content, due, recur, priority, projectRef, labelRefs,
  duration, spans}`. Spans carry exact substring ranges so the UI renders live
  chips. Rules that came from probing real Todoist (do not "fix" them):
  recurrence phrase **outranks** a one-shot date; `every!` = strict-from-
  completion; aliases canonicalize at parse (morning→`day 9am`, until→`ending`,
  workday→Mon–Fri).
- **Recurrence engine** (`src/shared/recur/`, M2): the **canonical recurrence
  string is the source of truth** — no serialized rule column. `parseRecur` is
  deterministic, so storing derived state would just be a cache that can lie.
  On complete: next due computes from old due (or from *now* iff strict).
- **Filter language** (M3): compiles a query AST to a **parameterized WHERE**
  clause — user input never concatenates into SQL. Saved filters store query
  text only.

## Renderer

- **Zustand stores with the api injected**, optimistic writes reconciled by
  `data:changed`. shadcn/ui components only, colors only via tokens, relative
  imports (no `@renderer` runtime alias — see 02-environment for why).
- **Design tokens**: shadcn HSL token blocks in `src/renderer/index.css` are
  the runtime palette; `docs/design/design-tokens.css` is reference-only and
  must never be imported (02-environment explains the collision).

## Dependency policy

Orchestrator-only; agents never touch `package.json`/lockfile. Runtime deps
stay minimal (M0: better-sqlite3, nanoid, zod; test: vitest, later
Playwright). Every addition is a deliberate decision recorded in a commit.

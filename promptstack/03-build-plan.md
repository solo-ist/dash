# 03 — Build plan

Replayable milestone order. The live queue is the GitHub board ("Dash Roadmap",
`solo-ist/dash` issues) — this doc is the distillation that survives board
churn. Milestone definitions of record: `docs/scope.md`. Gates: numbered `G*`
in `04-verification.md`.

## Phase 0 — Scaffold (done 2026-07-30)

Copy-don't-generate from Prose: configs, token blocks, shadcn `ui/` subset,
main-process window boilerplate (hiddenInset, traffic lights 16,16, dark
default, `#090909` background, sandbox invariants). Prune identity to
`ist.solo.dash`. Gate: G2 (dev shell renders dark tokened window).

## Phase 1 — Research (done 2026-07-30)

Reverse-engineer Todoist three ways — MCP API probing (scratch project),
desktop-app inspection, web-app walkthrough — into `docs/research/`. The
recurrence probe table is the crown jewel; everything downstream pins to it.

## Phase 2 — Scope freeze (done 2026-08-06)

Operator scope session over the tiered feature inventory → `docs/scope.md`
(frozen; changes require another session). Then `docs/architecture.md`
(2026-08-07) before any build mission — architecture is orchestrator work, not
agent work.

## M0 — Skeleton + quick-add

Success: **Angel adds a real task in week one.** Issue slicing (order matters;
`#n` = GitHub issue):

1. `#2` SQLite foundation — schema v0, migrations, mutation layer ┐ parallel
2. `#6` Quick-add parser core (pure module + probe-case tests)   ┘ (disjoint)
3. `#3` IPC bridge — generic query/mutate/data:changed across preload
4. `#4` Zustand stores with injected api, optimistic writes
5. `#5` Shell UI — sidebar, flat task list (tokens only, shadcn only)
6. `#7` Quick-add input with live chips (consumes #6 spans)
7. `#8` Complete/delete wiring
8. `#9` Playwright e2e: the persistence gate (G4)

Status 2026-09-04: **M0 complete on main** (`416a6cc`). Steps 1–2 via
goal/dash-m0-core (merged 2026-09-01), steps 3–8 via goal/dash-m0-app (5
iterations 2026-09-01, orchestrator-verified + merged 2026-09-04 — verification
caught and fixed a first-run Inbox cold-start bug and a broken e2e launcher).
All eight issues closed. Known deviation: preload shipped per-feature IPC
channels; restoring the generic surface (architecture §5) is issue `#15`,
scheduled before the M1 wave.

## M1 — Organize (done 2026-09-07)

Projects/sections CRUD, board view (sections as columns), subtasks, labels,
priorities UI, manual ordering (sparse sort keys, `src/shared/order/`), task
detail panel with markdown body. Delivered with #15 (generic IPC restored) by
goal/dash-m1-organize (7 iterations), orchestrator-verified + merged
`f7b3e54`. Verification caught two gaps, fixed pre-merge: data:changed
reconciliation was wired for labels only; the e2e had a mount race. Slices
`#16`–`#22` closed; polish nits → `#23`.

## M2 — Time

Full recurrence engine (`src/shared/recur/`, canonical-string semantics per
01), Today + Upcoming views, reminders → native notifications, duration,
deadline. (`#11`)

## M3 — Find

Filter query engine (AST → parameterized WHERE) + saved filters, FTS search +
command palette, completed log, archive. (`#12`)

## M4 — Native

Global quick-add window, tray + today list, dock badge, `dash://` deep links,
comments. (`#13`)

## M5 — Time-blocking + switch-over

Time-blocked Today + Plan panel, **one-time Todoist importer** (runs through
the same `mutate(op)` path as the UI), v1 polish. **v1 = M5 done and Angel
switches off Todoist for personal projects.** (`#14`)

## Standing loop (every wave)

Author mission/goal spec → agents produce work in worktrees → orchestrator
harvests (commits), reviews diff, runs G0+G1 (and G2/G4 when UI is touched) →
merges sequentially → closes issues with verification comments → updates board
fields. Dependency/lockfile/token/config changes are orchestrator-direct, never
delegated.

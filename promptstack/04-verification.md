# 04 — Verification

Ordered pass/fail gates. Run cheapest-first; a failing gate is a defect, never
a reason to weaken the gate. `npm run verify` = G0 + G1 and is the goal-loop
verify target.

## G0 — Typecheck

```
npm run typecheck
```
Both tsconfig projects (`tsconfig.json`, `tsconfig.node.json`) exit 0 with no
output beyond the script banner.

## G1 — Unit suite

```
npm test        # vitest run
```
All files green. Must include, at minimum:

- **All 12 recurrence probe cases** from `docs/research/mcp-ground-truth.md`
  as individual parser tests with a fixed `now` (deterministic — a test that
  passes only on certain weekdays is a defect).
- Parser span-exactness tests (each span slices to exactly its recognized
  substring; surrounding text survives as content).
- Mutation-layer round-trips vs an in-memory DB: task + project CRUD;
  tombstoned rows excluded from list queries; completion appends exactly one
  `completions` row; new tasks searchable via `task_fts`.
- Migration runner: applies to empty DB, sets `user_version`, idempotent on
  re-run.

Baseline 2026-08-31: 3 files, 37 tests, all passing (branch
`goal/dash-m0-core`). Counts grow; they never shrink without a removal being
named in a commit message.

## G2 — Shell renders (manual or scripted, when renderer changes)

```
npm run dev
```
Window opens: dark by default, `#090909` ground, paper text, IBM Plex Mono,
hiddenInset titlebar with traffic lights at (16,16). No console errors. Grep
gate alongside it: no runtime import of `docs/design/design-tokens.css`
anywhere under `src/`; no hardcoded hex/hsl colors in components.

## G3 — Engine semantics spot-probe (when parser/recur change)

The canonical-behavior pins, checkable by test or REPL:

- `parse("every! 2 weeks")` → strict recurrence, no due.
- `parse("every day until sep 30")` → canonical string uses `ending`.
- `parse("every morning")` → canonical `every day 9am`.
- A recurrence phrase and a separate one-shot date can coexist; the recurrence
  claims its span first.
- Due dates serialize as local wall-time (no `Z`, no offset).

## G4 — Persistence e2e (M0 exit gate)

```
npm run test:e2e    # Playwright, once e2e/ exists (issue #9)
```
The M0 definition of done, as an automated flow: launch app → quick-add a task
with a date token → chip renders → task appears in list → quit → relaunch →
task still present with parsed date → complete it → completion recorded.
Until #9 lands, run this by hand before declaring M0.

## G5 — Milestone exit

Each milestone in `03-build-plan.md` exits only when: all its issues closed
with verification comments, G0–G2 green on main, board updated, and the
milestone's success criterion (scope.md) demonstrably true — M0's is a real
task of Angel's, not a test fixture.

# 00 — Intent (DRAFT — awaiting operator ratification)

> Status: distilled 2026-08-31 from the project brief (2026-07-30) and the
> ratified scope session (2026-08-06, `docs/scope.md`). Angel has ratified the
> *scope*; this framing of intent has not itself been ratified. Do not treat
> the "must never" list as final until this header is removed by the operator.

## What Dash is

Dash is a **local-first personal task manager** — a rebuild of Todoist as a
native macOS desktop app — and a **sibling solo.ist app to Prose**, sharing its
design system (near-black ground, paper text, a single muted-gold accent, IBM
Plex Mono). It exists for one user: Angel. Their data lives in one SQLite file
on their machine, readable and backupable by them, owned by no service.

Dash has a second, equally weighted purpose: it is the **live stress test of
the Solo Prime orchestration stack**. Implementation work arrives as harness
missions and goal-loop runs executed by delegated agents (local Qwen, Codex,
Claude) in isolated worktrees, verified and merged by a frontier orchestrator.
Neither purpose outranks the other — a pipeline win that produces an app Angel
won't use is a failure, and vice versa.

## Who it serves and how

- Angel is the only user. ADHD-aware design is intent, not garnish: the
  signature interaction is **natural-language quick-add with live chips** —
  capture must be faster than the thought decays. Anchors (Today, time-blocked
  Plan) over deadline pressure.
- **v1 is done when Angel switches off Todoist for personal projects**
  (M5 in `docs/scope.md`). M0's success criterion is that Angel puts a real
  task into Dash within its first week.
- Scope of record: `docs/scope.md` (frozen 2026-08-06). Change it only via
  another explicit scope session with Angel — never by accretion.

## What Dash must never do

- **No runtime network. No telemetry. No accounts.** The app makes no network
  calls in normal operation. (The one-time Todoist importer is an explicit,
  user-invoked exception at switch-over; it is an import, not a sync.)
- **No silent sync.** v1 has no sync engine. The architecture keeps
  sync-*friendly* primitives (tombstones, unique ids, one write path) so sync
  can bolt on later, but any future sync is a new operator decision.
- **Shared family projects stay in Todoist.** The Marino Family workspace
  (Home, Recurring, Shopping) is collaborative; Dash v1 is single-user and must
  not become the place that data quietly migrates to.
- **No second UI vocabulary.** shadcn/ui + the solo.ist tokens are the entire
  visual language; one gold accent, used sparingly. No additional UI libraries,
  no hardcoded colors.
- **No dark patterns of its own host.** Dash never nags, gamifies, or scores
  (productivity stats/karma were deliberately declined — see scope non-goals).

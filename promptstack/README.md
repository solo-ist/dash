# Dash Prompt Stack

This directory is the **primary artifact** of this repository. The code in `src/`
is its output. Per the framing in "The Personal Software Revolution" (A. Marino,
Aug 2026): an agentic codebase's generative artifacts — intent, architectural
decisions, environmental knowledge, build plan, and verification gates — are the
human-readable, ratifiable, reproducible layer. An agent driving this stack
should be able to rebuild Dash to spec without access to the original code.

## Layout

| Doc | Role | Change cadence |
|---|---|---|
| `00-intent.md` | What Dash is and must never do | **Operator-ratified only** |
| `01-architecture.md` | Fixed decisions + why | With design changes, deliberately |
| `02-environment.md` | The external world a rebuild must assume | When the host reality changes |
| `03-build-plan.md` | Ordered milestones with gates | At milestone boundaries |
| `04-verification.md` | Pass/fail outcome contract | With every behavior change |

Precedence when documents and code disagree: **intent > architecture > code.**
Drift is flagged, never silently coded around (see AGENTS.md process rules).

## Delegation to `docs/`

Unlike the Termy exemplar, Dash keeps its deep canonical documents outside this
directory — they predate the stack and other planes reference them. The stack
docs here are the **authoritative spine**; where one says "full detail: …", the
referenced file is part of the stack's closure and a rebuild agent must read it
at that point:

- `docs/scope.md` — the frozen v1 decision record (feeds 00 + 03)
- `docs/architecture.md` — full architecture spec (feeds 01)
- `docs/research/mcp-ground-truth.md` — Todoist API probe results (feeds 02)
- `docs/research/data-model.md` — schema v0 draft (implemented; feeds 01)
- `AGENTS.md` — agent working rules (feeds 02)

If a spine doc and its referenced deep doc disagree, the spine doc wins and the
disagreement is drift to fix.

## Driving a rebuild

Entry prompt for the building agent:

> Read `promptstack/` in order (00 → 04), following its pointers into `docs/`
> where directed. Build the application it specifies in a fresh directory,
> milestone by milestone per `03-build-plan.md`, treating `04-verification.md`
> as the definition of done — every gate must pass, in order.
> `02-environment.md` is ground truth about the host and the Todoist semantics
> being reproduced; do not re-derive or doubt its empirical findings, they were
> paid for. Where the stack is silent, prefer the smallest choice consistent
> with `00-intent.md`, and record the choice you made as a proposed stack patch.

## Provenance & honesty

Bootstrapped 2026-08-31, mid-build: scaffold through the M0 core engines
(schema, mutation layer, quick-add parser) already existed, distilled here from
the live build sessions (2026-07-30 → 2026-08-31), the git history, and the
docs those sessions produced. `00-intent.md` is a DRAFT awaiting operator
ratification. This stack is a distillation, not a transcript: a rebuild that
diverges from `src/` while passing `04-verification.md` has found a stack gap —
feed the divergence back as a stack patch.

Maintenance: `/promptstack` (workspace skill, host side) audits drift and syncs
these docs; sync commits carry a `Stack-Sync:` trailer.

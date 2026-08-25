# CLAUDE.md — Dash

**Read `AGENTS.md` first — it is the canonical rules file for all agents in this
repo** (design rules, code conventions, commands, process rules). This file adds
Claude-specific context only.

## Project context

- Dash is a Todoist rebuild as a sibling solo.ist app to Prose
  (`../prose`) — when a design/pattern question isn't answered
  here, Prose is the reference implementation (window boilerplate, shadcn usage,
  settings persistence, menu structure).
- Roadmap and progress live on the GitHub Projects board and issues at
  `solo-ist/dash` — the board is the source of truth for what's in flight, not
  this file. Research docs: `docs/research/`. Scope: `docs/scope.md` (once frozen).
- This project doubles as a stress test of the Solo Prime orchestration harness:
  most implementation tasks arrive as Temporal mission tasks in isolated git
  worktrees, and are verified + merged by the orchestrator. Don't merge, push, or
  close issues from a mission task.

## Working style

- Slice work to the files named in the issue/task; keep diffs reviewable.
- Verify with `npm run typecheck` and (when present) `npm run test:e2e` before
  reporting done. If your sandbox lacks Bash, say "not verified" — never guess.

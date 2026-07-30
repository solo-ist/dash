# Orchestration pipeline notes (running log)

## dash-smoke-1 (2026-07-30) — all 3 lanes green

Trivial disjoint doc-stub tasks, one per exec lane, worktree mode.

| lane | harness | duration | result |
|---|---|---|---|
| claude | claude CLI | 16.3s | exact, followed constraints, best summary quality |
| codex | codex CLI | 47.1s | exact, self-verified via git status |
| qwen | opencode → litellm/qwen3-coder | 12.2s | exact, fastest (local, no network) |

Findings that shape the build loop:
1. **Agents do NOT commit.** Work comes back as untracked/modified files in the
   worktree; the `agent/<mission>-<task>` branch still points at base. Harvest =
   orchestrator commits in the worktree on that branch, then reviews/merges.
   (Matches the agreed merge policy: orchestrator verifies + merges.)
2. `filesChanged` in the mission result is trustworthy (diff + untracked) and is
   the fast pre-review signal for scope creep.
3. qwen latency on small tasks is excellent; the cap-1 queue, not speed, is its
   constraint. Reserve it for well-specified single-file tasks (as planned).
4. Worktree cleanup after discard: `git worktree remove --force <path>` +
   `git branch -D` from the dash repo.

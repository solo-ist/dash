# 02 — Environment

The external world a rebuild must assume. Empirical findings here were paid for
with real debugging or probing — do not re-derive or second-guess them.

## Host & toolchain

- macOS (Apple Silicon), account `solo-one` — **non-admin by design**; no
  Homebrew mutations from here. Node + npm; anything pip/uv goes via
  `uv tool install`.
- **Prose (`../prose`) is the design-system source and reference
  implementation.** The system is copy-in, not a package: token blocks, shadcn
  `ui/` components, window boilerplate, and configs were copied from Prose and
  edited for identity. When a design/pattern question is unanswered here, read
  Prose.
- Stack pins: Electron ^40, electron-vite ^5, React 18, TypeScript strict,
  Tailwind 3.4, shadcn/Radix, Zustand 5. Exact versions: `package-lock.json`.

## Orchestration contract (how code arrives)

- This repo has an **inbound writer**: the Solo Prime harness (Temporal, host
  side) dispatches agent missions and goal-loop runs into isolated worktrees at
  `~/.local/state/harness/worktrees/`, on branches `agent/<mission>-<task>` or
  `goal/<name>`. Agents follow `AGENTS.md`; they do not commit to main, merge,
  push, or close issues — the orchestrator harvests, verifies
  (`npm run verify`), merges sequentially, and owns the board.
- **GitHub `solo-ist/dash` + Projects board "Dash Roadmap" is the durable
  record** (Temporal retains only 7 days). Issues carry acceptance criteria;
  commits reference issue numbers.

## Todoist semantics being reproduced

Ground truth probed via the Todoist MCP against a scratch project
(2026-07-30): object shapes, the 12-case recurrence probe table, and the filter
grammar live in `docs/research/mcp-ground-truth.md`. That file is the arbiter
for "what would Todoist do" — not memory, not the marketing docs.

## Empirical findings

| Finding | Consequence | Verified |
|---|---|---|
| Todoist's desktop app is a thin Electron wrapper over app.todoist.com — no local DB (PWA IndexedDB only) | No prior art to crib for local schema; schema v0 designed from API shapes instead | 2026-07-30 |
| Recurrence: phrase outranks one-shot date; `every!` recomputes from completion time; aliases canonicalize (morning→9am, until→ending, workday→Mon–Fri) | Parser + recur engine encode these as law; tests pin all 12 probe cases | 2026-07-30 |
| `"type": "module"` makes electron-vite emit ESM preload, but a **sandboxed** preload must be CJS | Preload is built separately: `npm run build:preload` (esbuild → CJS); `dev`/`build` run it first | 2026-07-30 |
| `docs/design/design-tokens.css` defines bare hex `--accent`/`--border`, which clobber shadcn's HSL-triplet tokens (`hsl(var(--accent))` breaks) | Never import it at runtime; it is reference-only. Runtime brand values are namespaced `--brand-*` in `src/renderer/index.css` | 2026-07-30 |
| `components.json` aliases (`@renderer/…`) are consumed by the shadcn CLI only — Vite does not honor them at runtime, even when mirrored in electron-vite config | Relative imports throughout the renderer; no runtime alias | 2026-07-30 |
| npm's allow-scripts gate blocks electron/esbuild/better-sqlite3 postinstalls; better-sqlite3 additionally needs the Electron ABI | `npm approve-scripts <pkg>` per package, then `npx electron-builder install-app-deps` (wired as `postinstall`). The same build passes under vitest (node) | 2026-08-07 |
| Harness lanes: claude-lane tasks default to allowedTools without Bash; qwen lane is capacity-1; agents return work as **uncommitted files** in their worktree | Task specs widen `allowedTools` when tests must run; one qwen task per wave; orchestrator commits (harvests) agent output | 2026-07-30 |
| GUI `open` (e.g. `open -a Prose`) fails from a sandboxed shell with Launch Services error -600 | Run `open` unsandboxed when showing the operator a doc | 2026-07-30 |

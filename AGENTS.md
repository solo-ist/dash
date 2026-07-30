# AGENTS.md — Dash

Dash is a local-first task app (a Todoist rebuild) and a sibling solo.ist app to
Prose. This file is the canonical entry point for ALL coding agents (OpenCode/qwen,
Codex, Claude). Follow it exactly; when it conflicts with your habits, this file wins.

## What you are working on

- Electron ^40 + electron-vite ^5, React 18 + TypeScript, Tailwind 3.4 + shadcn/ui
  (Radix), Zustand 5, npm. Main process: `src/main/`. Preload: `src/preload/`
  (built separately via esbuild to CJS — see `build:preload`). Renderer:
  `src/renderer/`.
- Local-first and private: no accounts, no telemetry, no network calls at runtime.
  Data will live in SQLite in the main process (better-sqlite3, added when scoped).

## Design rules (non-negotiable)

- **shadcn/ui components only** (`src/renderer/components/ui/`). Never introduce
  another UI library. New shadcn components are copied in, not installed.
- **Colors only via tokens.** shadcn HSL tokens (`--background`, `--muted`, …) for
  UI chrome; `--brand-accent` (#c8a45a muted gold) is the ONLY brand color and is
  used sparingly. Never hardcode hex/hsl colors in components. Full reference
  palette: `docs/design/design-tokens.css` — reference only, never import it at
  runtime (its bare `--accent`/`--border` hex values clobber the shadcn tokens).
- Dark mode is the default (`class="dark"` on `<html>`). Both themes must work.
- Typography: IBM Plex Mono for all UI; Fraunces only for italic display accents.
- Animations minimal — only what shadcn/tailwindcss-animate ship by default.
- **Never edit** `src/renderer/index.css` token blocks, `tailwind.config.cjs`,
  `docs/design/design-tokens.css`, or `electron-builder.yml` unless your task
  prompt explicitly says so.

## Code conventions

- Relative imports within the renderer (`./components/ui/button`,
  `../../lib/utils`) — there is no `@renderer` runtime alias.
- Security invariants in `src/main/index.ts`: `sandbox: true`,
  `contextIsolation: true`, `nodeIntegration: false` — never change. All
  renderer↔main communication goes through the typed bridge in
  `src/preload/index.ts`; never widen it beyond what your task needs.
- Strict TypeScript; `npm run typecheck` must pass. No `any` unless unavoidable.

## Commands

```bash
npm run dev         # Electron + Vite HMR (builds preload first)
npm run typecheck   # both tsconfig projects
npm run build       # production build to out/
npm run test:e2e    # Playwright (once e2e/ exists)
```

## Process rules (harness tasks)

- Work ONLY on the files named in your task prompt. If the task seems to require
  touching other files, stop and say so in your final output instead of doing it.
- Never run `npm install`, never modify `package.json` dependencies or
  `package-lock.json` — dependency changes are orchestrator-only.
- Reference the GitHub issue number from your task prompt in commit messages
  (e.g. `Add quick-add parser (#12)`).
- Do not create new top-level directories, config files, or docs unless asked.
- Your final text should state: what you changed, files touched, and how you
  verified it (or that you could not verify — never claim untested work passes).

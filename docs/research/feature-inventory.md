# Todoist feature inventory & Dash tiering proposal

Sources: Todoist MCP (API ground truth, `mcp-ground-truth.md`), installed desktop
app inspection (v9.29.1 — thin Electron wrapper over app.todoist.com; local-first
is the web PWA's IndexedDB), and a Claude-in-Chrome walkthrough of the live web
app on 2026-07-30. Tiers are a PROPOSAL for Angel to react to: **Core** = v1,
**Likely** = probably v1.x, **Unlikely** = explicit non-goal.

## ⚠️ One real scope decision surfaced by research

The `Home`, `Recurring`, and `Shopping` projects live in a shared "Marino Family"
workspace (collaboration with Laura: assignees, shared boards). **Local-only Dash
cannot replace these** — collaboration requires sync by definition. Options:
(a) those projects stay in Todoist indefinitely; (b) scope creep to sync later.
Needs an explicit call in the scope session.

## Feature table

| Feature | Surface | Data deps | Complexity | Tier |
|---|---|---|---|---|
| Projects (flat + sub-projects, colors, favorites) | sidebar | projects | M | **Core** |
| Inbox (default project) | sidebar | projects | S | **Core** |
| Sections | list groups / board columns | sections | S | **Core** |
| Tasks CRUD + markdown content/description | everywhere | tasks | M | **Core** |
| Subtasks (parentId nesting) | task detail | tasks | M | **Core** |
| Priorities p1–p4 (colored rings) | task rows | tasks | S | **Core** |
| Labels (personal) | task detail, sidebar | labels | S | **Core** |
| Due dates (date / datetime) | task rows, detail | tasks | M | **Core** |
| **Quick-add with NL parsing** (chips: date, `p2`, `#project`, `@label`; recurrence wins over one-shot date; inline tokenization as you type) | q shortcut | parser | **L** | **Core** |
| **Recurrence engine** (grammar subset: daily/weekly/monthly/nth-weekday/last-day/multi-day/intervals/`every!` strict/end bounds/time-of-day; canonicalized string + next-due recompute on complete) | quick-add, detail | tasks | **L** | **Core** |
| Today view (list form) | sidebar | query | M | **Core** |
| Upcoming view (week strip + day sections + overdue block) | sidebar | query | M | **Core** |
| Manual ordering (drag, `order` fields) | lists/boards | all | M | **Core** |
| Board view per project | project view | sections | M | **Core** |
| Completed log (per project + global) | project menu | tasks | S | **Core** |
| Search (title/description) | cmd+k palette | FTS | M | **Core** |
| Keyboard-first UX (q add, quick nav) | global | — | M | **Core** |
| Reminders → native notifications (relative-to-due + absolute) | task detail | reminders | M | **Core** |
| Desktop-native trio: **global quick-add window** (frameless, Alt+Space-style), **tray menu with today's tasks**, **dock badge count** | shell | IPC | M | **Core** |
| Duration field ("30m") + time ranges on rows | detail, rows | tasks | S | **Likely** |
| Deadline (second date, immovable, distinct badge) | detail | tasks | S | **Likely** |
| Filters (saved query language: `p1`, `overdue`, `no date`, `7 days`, `due after:`, `#proj`, `/section`, `@label`, boolean ops) | sidebar | filters + query engine | **L** | **Likely** (subset) |
| Today as time-blocked calendar layout + Plan panel | Today view | durations | L | **Likely** |
| Calendar view per project | project view | tasks | L | **Likely** |
| Task comments (solo notes + attachments) | detail | comments | M | **Likely** |
| Archive (projects, completed cleanup) | project menu | projects | S | **Likely** |
| Productivity stats (daily/weekly goal, streaks — Reporting lite) | Reporting | completion log | M | **Likely** |
| `dash://` deep links (today, project, task, quick-add) | shell | — | S | **Likely** |
| Sync / accounts / multi-device | — | — | XL | **Unlikely** (non-goal: local-only decided) |
| Collaboration: workspaces, sharing, assignees | boards | — | XL | **Unlikely** (see scope decision above) |
| External calendar integration (Google events in Today/Upcoming) | views | — | L | **Unlikely** |
| Location reminders | detail | — | L | **Unlikely** |
| Ramble (voice capture) | quick-add | — | L | **Unlikely** |
| macOS widgets / Siri App Intents / Share ext / Safari ext | system | — | XL | **Unlikely** |
| Templates, email-forwarding, browser clipper | misc | — | L–XL | **Unlikely** |
| Karma social/vacation mode | Reporting | — | M | **Unlikely** |

## UI observations that transfer to Dash's design language

- Priority = colored ring on the check circle (p1 red, p2 orange, p3 blue, p4 grey)
  — maps cleanly onto solo.ist restraint if we render rings in muted tones with
  the gold accent reserved for today/overdue emphasis.
- Task URL slugs (`/app/task/<slug>-<id>`) → Dash deep links.
- Detail panel = modal with breadcrumb, markdown body, right rail of field rows —
  a natural shadcn Dialog + field-list composition.
- Quick-add live-tokenizes inline (chips highlight as you type, stay editable as
  text) — this is the single highest-effort/highest-value interaction to get right.

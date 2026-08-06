# Dash v1 scope — frozen 2026-08-06 (scope session with Angel)

Supersedes the tiering *proposal* in `research/feature-inventory.md`; this file is
the decision record. Change it only via another explicit scope session.

## v1 IN

**Data & engine**
- Projects (sub-projects, colors, favorites, archive), Inbox, sections
- Tasks: markdown content/description, subtasks, priorities p1–p4, labels,
  manual ordering everywhere
- Due dates (date/datetime) + **deadline** (second, immovable date)
- **Full recurrence subset** (daily/weekly/monthly/nth-weekday/last-day/
  intervals/multi-day/time-of-day/`every!` strict/end bounds) — canonical string
  + next-due recompute on complete
- Duration field + time ranges
- Reminders → native notifications (relative + absolute)
- Completed log + completions history table
- **Saved filters** with query subset: `p1..p4, overdue, no date, N days,
  due after:, #project, /section, @label, ! & | ()`
- Search (FTS, command palette)
- Task comments (solo notes)
- **One-time Todoist importer** (export/MCP → projects/sections/tasks/labels/
  recurrence; runs once at switch-over; NOT sync)

**UI**
- **NL quick-add with live chips** — in M0, the signature interaction
- Sidebar (Inbox/Today/Upcoming/Filters/Favorites/projects), list view,
  board view (sections as columns), task detail panel
- Today: list first, then **time-blocked calendar layout + Plan panel**
- Upcoming (week strip + day sections + overdue block)

**Desktop-native**
- Global quick-add window (frameless, global shortcut), tray menu with today's
  tasks, dock badge, `dash://` deep links (today/project/task/quick-add)

**Architecture posture**
- **Sync-friendly primitives, no op-log**: globally-unique ids, soft-delete
  tombstones, `updated_at` on every row, all writes through one mutation layer.
  Rationale: "architect for future sync" (Marino Family workspace may want in
  someday) at primitive cost only; a change-log engine can bolt on later with a
  full-state bootstrap.

## v1 OUT (explicit non-goals)

- Sync, accounts, multi-device (future possibility — see posture above)
- Collaboration (workspaces/sharing/assignees) — **Marino Family projects
  (Home, Recurring, Shopping) stay in Todoist**
- External calendar events in views
- Productivity stats/goals/streaks (deliberately declined — completions table
  still records history, so this can revisit cheaply)
- Ramble/voice, macOS widgets/Siri/share/Safari extensions, templates,
  email-forwarding, location reminders, karma-social

## Milestones

- **M0 — Skeleton + quick-add**: shell, sidebar, flat list, SQLite + mutation
  layer (sync primitives), NL quick-add v1 (date/recurrence-basic/p/#/@ chips),
  complete/delete, persistence across restart. *Success: Angel adds a real task
  in week one.*
- **M1 — Organize**: projects/sections CRUD, board view, subtasks, labels,
  priorities UI, manual ordering, task detail panel.
- **M2 — Time**: full recurrence engine, Today (list) + Upcoming views,
  reminders/notifications, duration, deadline.
- **M3 — Find**: filter query engine + saved filters, FTS search + palette,
  completed log, archive.
- **M4 — Native**: global quick-add window, tray + today list, dock badge,
  `dash://` deep links, comments.
- **M5 — Time-blocking + switch-over**: time-blocked Today + Plan panel,
  one-time importer, v1 polish. **v1 = M5 done, Angel switches off Todoist for
  personal projects.**

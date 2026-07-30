# Dash data model — draft SQLite schema (v0)

Derived from Todoist API ground truth (`mcp-ground-truth.md`). Main-process
better-sqlite3, WAL mode. All ids TEXT (nanoid). Times stored as ISO-8601 local
strings (Todoist's model) with a `*_utc` companion only where sorting across DST
matters. Draft — the architecture spec will finalize.

```sql
CREATE TABLE projects (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  color         TEXT NOT NULL DEFAULT 'charcoal',   -- 20-key palette name
  parent_id     TEXT REFERENCES projects(id),       -- sub-projects
  is_inbox      INTEGER NOT NULL DEFAULT 0,         -- exactly one row = 1
  is_favorite   INTEGER NOT NULL DEFAULT 0,
  view_style    TEXT NOT NULL DEFAULT 'list',       -- list | board | calendar
  child_order   INTEGER NOT NULL DEFAULT 0,
  archived_at   TEXT                                 -- NULL = active
);

CREATE TABLE sections (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  section_order INTEGER NOT NULL DEFAULT 0,
  archived_at   TEXT
);

CREATE TABLE tasks (
  id            TEXT PRIMARY KEY,
  content       TEXT NOT NULL,                      -- markdown, single line-ish
  description   TEXT NOT NULL DEFAULT '',           -- markdown, multi-line
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_id    TEXT REFERENCES sections(id) ON DELETE SET NULL,
  parent_id     TEXT REFERENCES tasks(id) ON DELETE CASCADE,  -- subtasks
  priority      INTEGER NOT NULL DEFAULT 4,         -- 1 highest .. 4 default
  due_date      TEXT,                               -- '2026-10-03' or '2026-11-11T16:00:00'
  due_has_time  INTEGER NOT NULL DEFAULT 0,
  recur_string  TEXT,                               -- canonical grammar string, NULL = one-shot
  recur_strict  INTEGER NOT NULL DEFAULT 0,         -- every! semantics
  recur_ends    TEXT,                               -- 'ending 2026-09-30' bound, denormalized
  deadline_date TEXT,                               -- second, immovable date (date-only)
  duration_min  INTEGER,                            -- minutes, max 1440
  task_order    INTEGER NOT NULL DEFAULT 0,         -- manual sort among siblings
  is_header     INTEGER NOT NULL DEFAULT 0,         -- uncompletable organizational row
  checked       INTEGER NOT NULL DEFAULT 0,
  completed_at  TEXT,
  added_at      TEXT NOT NULL
);

CREATE TABLE labels (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  color         TEXT NOT NULL DEFAULT 'charcoal',
  label_order   INTEGER NOT NULL DEFAULT 0,
  is_favorite   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE task_labels (
  task_id  TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

CREATE TABLE reminders (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,                      -- 'relative' | 'absolute'
  minute_offset INTEGER,                            -- relative: minutes before due
  at            TEXT                                -- absolute datetime
);

CREATE TABLE filters (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  query        TEXT NOT NULL,                       -- Dash filter grammar (subset)
  color        TEXT NOT NULL DEFAULT 'charcoal',
  is_favorite  INTEGER NOT NULL DEFAULT 0,
  item_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE comments (                             -- Likely tier
  id        TEXT PRIMARY KEY,
  task_id   TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content   TEXT NOT NULL,
  posted_at TEXT NOT NULL
);

-- Completion history for stats/streaks (task row keeps only latest state;
-- recurring completions append here on each cycle).
CREATE TABLE completions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id      TEXT NOT NULL,
  content      TEXT NOT NULL,                       -- denormalized snapshot
  project_id   TEXT NOT NULL,
  completed_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE task_fts USING fts5(content, description, content=tasks);
```

## Semantics that must match the probe findings

1. **Recurrence**: store canonical string + concrete `due_date` (next occurrence).
   On complete: recurring → append to `completions`, recompute `due_date` from
   `recur_string` (base = old due date, or completion time when `recur_strict`);
   past `recur_ends` → convert to checked. One-shot → `checked=1, completed_at`.
2. **Quick-add parser** feeds the same grammar as the recurrence engine; one-shot
   NL dates ("next tuesday at noon") and recurrence share the parser, recurrence
   phrase outranks a one-shot date in the same input.
3. **Aliases canonicalize at parse time** (morning→9am, workday→Mon–Fri,
   until X→ending X) — store canonical, render canonical.
4. **Ordering** is manual-first everywhere (`child_order`, `section_order`,
   `task_order`); views sort by (section, task_order) with date views sorting by
   (due, priority, task_order).
5. Priority stored 1–4 int; rendered as p1–p4 with ring colors.
```

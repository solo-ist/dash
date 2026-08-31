-- Dash schema v0 (docs/research/data-model.md) plus sync primitives from
-- architecture.md §3: every entity table gets updated_at (UTC ISO, NOT NULL)
-- and deleted_at (tombstone, NULL = live). completions stays append-only.

CREATE TABLE projects (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  color         TEXT NOT NULL DEFAULT 'charcoal',
  parent_id     TEXT REFERENCES projects(id),
  is_inbox      INTEGER NOT NULL DEFAULT 0,
  is_favorite   INTEGER NOT NULL DEFAULT 0,
  view_style    TEXT NOT NULL DEFAULT 'list',
  child_order   INTEGER NOT NULL DEFAULT 0,
  archived_at   TEXT,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);

CREATE TABLE sections (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  section_order INTEGER NOT NULL DEFAULT 0,
  archived_at   TEXT,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);

CREATE TABLE tasks (
  id            TEXT PRIMARY KEY,
  content       TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_id    TEXT REFERENCES sections(id) ON DELETE SET NULL,
  parent_id     TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  priority      INTEGER NOT NULL DEFAULT 4,
  due_date      TEXT,
  due_has_time  INTEGER NOT NULL DEFAULT 0,
  recur_string  TEXT,
  recur_strict  INTEGER NOT NULL DEFAULT 0,
  recur_ends    TEXT,
  deadline_date TEXT,
  duration_min  INTEGER,
  task_order    INTEGER NOT NULL DEFAULT 0,
  is_header     INTEGER NOT NULL DEFAULT 0,
  checked       INTEGER NOT NULL DEFAULT 0,
  completed_at  TEXT,
  added_at      TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);

CREATE TABLE labels (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  color         TEXT NOT NULL DEFAULT 'charcoal',
  label_order   INTEGER NOT NULL DEFAULT 0,
  is_favorite   INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);

CREATE TABLE task_labels (
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id   TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (task_id, label_id)
);

CREATE TABLE reminders (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  minute_offset INTEGER,
  at            TEXT,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);

CREATE TABLE filters (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  query        TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT 'charcoal',
  is_favorite  INTEGER NOT NULL DEFAULT 0,
  item_order   INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);

CREATE TABLE comments (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  posted_at  TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

-- Completion history for stats/streaks (task row keeps only latest state;
-- recurring completions append here on each cycle). Append-only: no
-- updated_at/deleted_at.
CREATE TABLE completions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id      TEXT NOT NULL,
  content      TEXT NOT NULL,
  project_id   TEXT NOT NULL,
  completed_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE task_fts USING fts5(
  content,
  description,
  content='tasks',
  content_rowid='rowid'
);

CREATE TRIGGER tasks_ai AFTER INSERT ON tasks BEGIN
  INSERT INTO task_fts(rowid, content, description)
  VALUES (new.rowid, new.content, new.description);
END;

CREATE TRIGGER tasks_ad AFTER DELETE ON tasks BEGIN
  INSERT INTO task_fts(task_fts, rowid, content, description)
  VALUES ('delete', old.rowid, old.content, old.description);
END;

CREATE TRIGGER tasks_au AFTER UPDATE ON tasks BEGIN
  INSERT INTO task_fts(task_fts, rowid, content, description)
  VALUES ('delete', old.rowid, old.content, old.description);
  INSERT INTO task_fts(rowid, content, description)
  VALUES (new.rowid, new.content, new.description);
END;

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_sections_project_id ON sections(project_id);
CREATE INDEX idx_task_labels_label_id ON task_labels(label_id);

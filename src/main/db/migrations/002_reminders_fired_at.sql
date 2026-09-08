-- Reminders need to remember the last instant they fired so the scheduler
-- doesn't re-notify for the same occurrence on every rearm/app restart
-- (architecture.md §10). NULL = never fired.
ALTER TABLE reminders ADD COLUMN fired_at TEXT;

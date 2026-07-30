# Todoist data model — API ground truth (via Todoist MCP, 2026-07-30)

Observed live against a Todoist Pro account (v1 API via MCP). Field names below are
as the MCP returns them; the underlying Sync API uses snake_case equivalents.

## Object shapes observed

### Task
```jsonc
{
  "id": "6VVR6rwr8mg2pXMx",          // opaque string id
  "content": "Cover AC unit",         // markdown supported, incl. [links](url)
  "description": "",                  // markdown, multi-line
  "dueDate": "2026-11-11T16:00:00",   // date-only "2026-10-03" or local datetime
  "recurring": "every November 11 at 4pm", // display string, or false
  "deadlineDate": "2026-08-14",       // OPTIONAL second date — immovable constraint,
                                      // distinct from due (due = start/plan date)
  "priority": "p1".."p4",             // p4 = default/lowest
  "projectId": "...",
  "sectionId": "...",                 // present when in a board column
  "parentId": "...",                  // subtasks
  "labels": ["no-agent"],             // by name, not id
  "duration": "30m",                  // optional; "2h30m" formats, max 24h
  "assignedByUid": "...", "responsibleUid": "...", // shared projects
  "checked": false,
  "completedAt": "...",               // completed tasks only
  "addedAt": "2024-06-13T21:59:37.811Z",
  "order": n,                         // sibling ordering
  "isUncompletable": true             // organizational header tasks
}
```

### Project
`id, name, description, color (20-key palette), isFavorite, isShared, inboxProject,
viewStyle: list|board|calendar, workspaceId?, childOrder, isArchived, parentId?`
— Inbox is a real project with `inboxProject: true`. Sub-projects via `parentId`.

### Section
`id, name, sectionOrder` — scoped to a project; board columns ARE sections.
List-view projects can have zero sections (flat list).

### Label
Personal labels: `id, name, color, order, isFavorite`. Shared labels: names only
(exist merely as strings on tasks in shared projects).

### Filter
`id, name, query, color, isFavorite, itemOrder` — saved query strings.

### Reminder
`{ id, taskId, type: "relative"|"absolute"|"location", minuteOffset, due: {isRecurring,
string, date}, isUrgent }` — relative = offset before task's due datetime.

### User
`userId, fullName, email, timezone, startDay (1=Mon), dailyGoal, weeklyGoal,
completedToday, plan` — karma/productivity is account-level.

## Recurrence grammar — probe results (input → normalized)

Todoist stores recurrence as a canonical STRING plus the next concrete dueDate;
each completion re-derives the next dueDate from the string.

| input | normalized string | first dueDate | note |
|---|---|---|---|
| every day | every day | today (date-only) | |
| every workday at 9am | every workday at 9am | today 09:00 | weekday set |
| every 3rd friday | every 3rd friday | 2026-08-21 | nth-weekday-of-month |
| every! 2 weeks | every! 2 weeks | today | `!` = strict: next occurrence from completion date, not due date |
| every jan 15 | every jan 15 | 2027-01-15 | yearly by date |
| every mon, wed, fri at 8:30 | every mon, wed, fri at 8:30 | next matching day 08:30 | multi-day list |
| every last day | every last day | month-end | last-day-of-month |
| every 2 months starting aug 15 | **every 2 months** | 2026-08-15 | start-anchor folded into first dueDate |
| next tuesday at noon | (not recurring) | 2026-08-11T12:00 | NL one-shot dates share the parser |
| every morning | **every day 9am** | today 09:00 | alias canonicalized |
| every day until sep 30 | **every day ending 2026-09-30** | today | end date canonicalized into string |
| every 6 hours | every 6 hours | now+? (datetime) | sub-daily supported |

Implications for Dash's recurrence engine:
1. Store the canonical recur string + next-occurrence datetime; recompute on complete.
2. Two completion semantics: normal (next from due date) vs strict `every!` (next
   from completion time).
3. Parser and NL date parser are one grammar (quick-add parses both).
4. Aliases (morning=9am, workday=Mon–Fri) and end bounds (`ending <date>`) are
   canonicalized at parse time, not kept verbatim.

## Filter query grammar (from 12 real saved filters)

Operators observed: `|` OR, `&` AND, `!` NOT, `()` grouping, `,` multi-list.
Atoms observed: `p1..p4` (priority), `overdue`, `no date`, `3 days`/`7 days`
(within-N-days), `due after: +3 days`, `#Project`, `/Section`, `@label`,
`assigned`. (Full grammar is larger; this is the subset a real power user uses.)

## Priorities, ordering, misc

- Priority is an enum p1..p4 (p4 default); UI color-codes p1 red / p2 orange / p3 blue.
- Ordering: `childOrder` (projects), `sectionOrder`, task `order` — manual sort is
  first-class everywhere.
- Duration is a first-class field (feeds calendar view / time blocking).
- `deadlineDate` vs `dueDate` is a real, recent distinction: due = when you plan to
  do it (movable, recurring), deadline = hard constraint (different UI badge).

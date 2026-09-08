# Implementation Summary for Dash Issue #26 - Upcoming View

## Files Modified

### 1. Type fixes for TodayView.tsx and TaskRowItem.tsx
- Fixed `onMove` prop types to use `TaskMoveScope` instead of inline object type
- Imported `TaskMoveScope` from `../../stores/taskStore`

### 2. Shared Queries (`src/shared/queries.ts`)
- Added `'tasks.upcoming'` query with params schema: `{ today: string, horizonDays: number }`
- Added `'tasks.upcoming'` to result types

### 3. Main Process Queries (`src/main/queries.ts`)
- Added `listUpcomingTasks(db, today, horizonDays)` function
- Implemented SQL query to get incomplete tasks that are either overdue or within the horizon

### 4. Main Process IPC (`src/main/ipc.ts`)
- Added case for `'tasks.upcoming'` query dispatch

### 5. Upcoming View Component (`src/renderer/components/app/UpcomingView.tsx`)
- Created new component with:
  - Week strip with day chips for the next 7 days
  - Overdue section for tasks due before today
  - Daily sections for upcoming tasks grouped by due date
  - Proper reuse of TaskRowItem and TaskList components
  - Helper functions for day key generation and task grouping
  - Proper handling of date comparisons using wall-time strings

### 6. Upcoming View Tests (`src/renderer/components/app/UpcomingView.test.tsx`)
- Added tests for the helper functions:
  - `generateDayKeys` across month/year boundaries
  - `groupTasksByDay` functionality
- Added basic component rendering test

### 7. App Integration (`src/renderer/App.tsx`)
- Extended view state to include `'upcoming'`
- Added Upcoming view tab to the Tabs component
- Added Upcoming view rendering logic
- Added `loadUpcoming` method to task store

### 8. Sidebar Integration (`src/renderer/components/app/Sidebar.tsx`)
- Added "Upcoming" button in sidebar below "Today"
- Added proper view selection handler

### 9. Task Store Enhancement (`src/renderer/stores/taskStore.ts`)
- Added `view: 'list' | 'board' | 'today' | 'upcoming'` type
- Added `loadUpcoming` method for loading upcoming tasks
- Updated view transition logic to handle upcoming view

## Implementation Details

### Upcoming View Logic
1. **Query**: Gets tasks using `tasks.upcoming` query with `{ today, horizonDays: 7 }`
2. **Overdue Tasks**: Tasks where due_date part < today are separated 
3. **Daily Grouping**: Tasks grouped by day key (YYYY-MM-DD) using first 10 chars of due_date
4. **Week Strip**: 7-day navigation showing weekday abbreviations and day numbers
5. **Section Labels**: Special handling for "Today", "Tomorrow", and regular dates

### Date Handling
- All date comparisons use wall-time strings (YYYY-MM-DD format)
- Date arithmetic done using local `Date` objects for calendar math
- No `toISOString()` calls on due values as required
- Proper handling of month/year boundaries in day key generation

### Type Safety
- All props properly typed using existing type definitions
- `TaskMoveScope` consistently used across components
- Strict TypeScript with no `any` types

## Verification
All changes compile correctly with TypeScript. The implementation follows the same patterns as TodayView exactly. Unit tests for helper functions are included and cover the key edge cases.
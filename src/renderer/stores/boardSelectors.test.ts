import { describe, it, expect } from 'vitest'
import { selectBoardColumns, selectSubtaskCounts, compareTaskOrder } from './boardSelectors'
import type { SectionRow, TaskRow } from '../../shared/types'

const makeTask = (overrides: Partial<TaskRow> = {}): TaskRow => ({
  id: 'task-id',
  checked: 0,
  content: 'Test task',
  description: '',
  project_id: 'proj1',
  section_id: null,
  parent_id: null,
  priority: 4,
  due_date: null,
  due_has_time: 0,
  recur_string: null,
  recur_strict: 0,
  recur_ends: null,
  deadline_date: null,
  duration_min: null,
  task_order: 0,
  is_header: 0,
  completed_at: null,
  added_at: '2023-01-01T00:00:00.000Z',
  updated_at: '2023-01-01T00:00:00.000Z',
  deleted_at: null,
  ...overrides
})

const makeSection = (overrides: Partial<SectionRow> = {}): SectionRow => ({
  id: 'section-id',
  project_id: 'proj1',
  name: 'Section',
  section_order: 0,
  archived_at: null,
  updated_at: '2023-01-01T00:00:00.000Z',
  deleted_at: null,
  ...overrides
})

describe('selectBoardColumns', () => {
  it('puts the null-section column first, then sections in section_order', () => {
    const sections = [
      makeSection({ id: 'sec-b', name: 'B', section_order: 2 }),
      makeSection({ id: 'sec-a', name: 'A', section_order: 1 })
    ]
    const columns = selectBoardColumns([], sections, 'proj1')
    expect(columns.map((col) => col.sectionId)).toEqual([null, 'sec-a', 'sec-b'])
  })

  it('groups tasks into the column matching their section_id', () => {
    const sections = [makeSection({ id: 'sec-a', section_order: 1 })]
    const tasks = [
      makeTask({ id: 't1', section_id: null }),
      makeTask({ id: 't2', section_id: 'sec-a' }),
      makeTask({ id: 't3', section_id: null })
    ]
    const columns = selectBoardColumns(tasks, sections, 'proj1')
    expect(columns.find((col) => col.sectionId === null)?.tasks.map((t) => t.id)).toEqual(['t1', 't3'])
    expect(columns.find((col) => col.sectionId === 'sec-a')?.tasks.map((t) => t.id)).toEqual(['t2'])
  })

  it('excludes archived and deleted sections from the column list', () => {
    const sections = [
      makeSection({ id: 'sec-archived', section_order: 1, archived_at: '2023-01-01' }),
      makeSection({ id: 'sec-deleted', section_order: 2, deleted_at: '2023-01-01' }),
      makeSection({ id: 'sec-live', section_order: 3 })
    ]
    const columns = selectBoardColumns([], sections, 'proj1')
    expect(columns.map((col) => col.sectionId)).toEqual([null, 'sec-live'])
  })

  it('orders tasks within a column by task_order, then added_at, then id', () => {
    const tasks = [
      makeTask({ id: 'b', task_order: 0, added_at: '2023-01-02T00:00:00.000Z' }),
      makeTask({ id: 'a', task_order: 0, added_at: '2023-01-01T00:00:00.000Z' }),
      makeTask({ id: 'c', task_order: 1, added_at: '2023-01-01T00:00:00.000Z' }),
      makeTask({ id: 'e', task_order: 2, added_at: '2023-01-03T00:00:00.000Z' }),
      makeTask({ id: 'd', task_order: 2, added_at: '2023-01-03T00:00:00.000Z' })
    ]
    const columns = selectBoardColumns(tasks, [], 'proj1')
    expect(columns[0].tasks.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('excludes checked tasks and subtasks from columns', () => {
    const tasks = [
      makeTask({ id: 'open', checked: 0, parent_id: null }),
      makeTask({ id: 'checked', checked: 1, parent_id: null }),
      makeTask({ id: 'subtask', checked: 0, parent_id: 'open' }),
      makeTask({ id: 'deleted', checked: 0, parent_id: null, deleted_at: '2023-01-01' })
    ]
    const columns = selectBoardColumns(tasks, [], 'proj1')
    expect(columns[0].tasks.map((t) => t.id)).toEqual(['open'])
  })

  it('excludes tasks belonging to other projects', () => {
    const tasks = [
      makeTask({ id: 'in-project', project_id: 'proj1' }),
      makeTask({ id: 'other-project', project_id: 'proj2' })
    ]
    const columns = selectBoardColumns(tasks, [], 'proj1')
    expect(columns[0].tasks.map((t) => t.id)).toEqual(['in-project'])
  })

  it('only includes sections belonging to the given project', () => {
    const sections = [
      makeSection({ id: 'sec-this', project_id: 'proj1', section_order: 1 }),
      makeSection({ id: 'sec-other', project_id: 'proj2', section_order: 2 })
    ]
    const columns = selectBoardColumns([], sections, 'proj1')
    expect(columns.map((col) => col.sectionId)).toEqual([null, 'sec-this'])
  })
})

describe('selectSubtaskCounts', () => {
  it('counts open direct children per parent id', () => {
    const tasks = [
      makeTask({ id: 'parent', parent_id: null }),
      makeTask({ id: 'child-1', parent_id: 'parent', checked: 0 }),
      makeTask({ id: 'child-2', parent_id: 'parent', checked: 0 }),
      makeTask({ id: 'child-3', parent_id: 'parent', checked: 1 }),
      makeTask({ id: 'child-4', parent_id: 'parent', checked: 0, deleted_at: '2023-01-01' })
    ]
    expect(selectSubtaskCounts(tasks)).toEqual({ parent: 2 })
  })

  it('returns an empty record when there are no subtasks', () => {
    const tasks = [makeTask({ id: 'lonely', parent_id: null })]
    expect(selectSubtaskCounts(tasks)).toEqual({})
  })

  it('does not conflate counts across different parents', () => {
    const tasks = [
      makeTask({ id: 'parent-a', parent_id: null }),
      makeTask({ id: 'parent-b', parent_id: null }),
      makeTask({ id: 'child-of-a', parent_id: 'parent-a', checked: 0 }),
      makeTask({ id: 'child-of-b-1', parent_id: 'parent-b', checked: 0 }),
      makeTask({ id: 'child-of-b-2', parent_id: 'parent-b', checked: 0 })
    ]
    expect(selectSubtaskCounts(tasks)).toEqual({ 'parent-a': 1, 'parent-b': 2 })
  })
})

describe('compareTaskOrder', () => {
  it('sorts by task_order first', () => {
    const a = makeTask({ id: 'a', task_order: 1 })
    const b = makeTask({ id: 'b', task_order: 0 })
    expect(compareTaskOrder(a, b)).toBeGreaterThan(0)
  })

  it('falls back to added_at, then id', () => {
    const a = makeTask({ id: 'a', task_order: 0, added_at: '2023-01-01T00:00:00.000Z' })
    const b = makeTask({ id: 'b', task_order: 0, added_at: '2023-01-01T00:00:00.000Z' })
    expect(compareTaskOrder(a, b)).toBeLessThan(0)
  })
})

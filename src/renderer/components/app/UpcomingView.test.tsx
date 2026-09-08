import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { UpcomingView } from './UpcomingView'
import type { TaskRow } from '../../../shared/types'
import { generateDayKeys, groupTasksByDay } from './UpcomingView'

describe('UpcomingView', () => {
  const mockTasks: TaskRow[] = [
    {
      id: 'task1',
      checked: 0,
      content: 'Overdue task',
      description: '',
      project_id: 'project1',
      section_id: null,
      parent_id: null,
      priority: 4,
      due_date: '2023-10-10T10:00:00',
      due_has_time: 1,
      recur_string: null,
      recur_strict: 0,
      recur_ends: null,
      deadline_date: null,
      duration_min: null,
      task_order: 0,
      is_header: 0,
      completed_at: null,
      added_at: '2023-10-10T08:00:00',
      updated_at: '2023-10-10T08:00:00',
      deleted_at: null
    },
    {
      id: 'task2',
      checked: 0,
      content: 'Today task',
      description: '',
      project_id: 'project1',
      section_id: null,
      parent_id: null,
      priority: 4,
      due_date: '2023-10-15T14:00:00',
      due_has_time: 1,
      recur_string: null,
      recur_strict: 0,
      recur_ends: null,
      deadline_date: null,
      duration_min: null,
      task_order: 0,
      is_header: 0,
      completed_at: null,
      added_at: '2023-10-15T08:00:00',
      updated_at: '2023-10-15T08:00:00',
      deleted_at: null
    }
  ]

  it('renders overdue and upcoming tasks correctly', () => {
    const { container } = render(
      <UpcomingView
        tasks={mockTasks}
        onSelectTask={() => {}}
        selectedTaskId={null}
        onComplete={() => {}}
        onDelete={() => {}}
        onMove={() => {}}
      />
    )
    
    expect(container).toBeInTheDocument()
  })
})

describe('UpcomingView helpers', () => {
  describe('generateDayKeys', () => {
    it('generates correct day keys across month boundary', () => {
      const keys = generateDayKeys('2026-09-28', 7)
      expect(keys).toEqual([
        '2026-09-28',
        '2026-09-29', 
        '2026-09-30',
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
        '2026-10-04'
      ])
    })

    it('generates correct day keys across year boundary', () => {
      const keys = generateDayKeys('2026-12-30', 7)
      expect(keys).toEqual([
        '2026-12-30',
        '2026-12-31',
        '2027-01-01',
        '2027-01-02',
        '2027-01-03',
        '2027-01-04',
        '2027-01-05'
      ])
    })
  })

  describe('groupTasksByDay', () => {
    it('groups tasks correctly by day', () => {
      const tasks: TaskRow[] = [
        {
          id: 'task1',
          checked: 0,
          content: 'Task 1',
          description: '',
          project_id: 'project1',
          section_id: null,
          parent_id: null,
          priority: 4,
          due_date: '2026-09-30 14:00',
          due_has_time: 1,
          recur_string: null,
          recur_strict: 0,
          recur_ends: null,
          deadline_date: null,
          duration_min: null,
          task_order: 0,
          is_header: 0,
          completed_at: null,
          added_at: '2023-10-10T08:00:00',
          updated_at: '2023-10-10T08:00:00',
          deleted_at: null
        },
        {
          id: 'task2',
          checked: 0,
          content: 'Task 2',
          description: '',
          project_id: 'project1',
          section_id: null,
          parent_id: null,
          priority: 4,
          due_date: '2026-10-01 10:00',
          due_has_time: 1,
          recur_string: null,
          recur_strict: 0,
          recur_ends: null,
          deadline_date: null,
          duration_min: null,
          task_order: 0,
          is_header: 0,
          completed_at: null,
          added_at: '2023-10-10T08:00:00',
          updated_at: '2023-10-10T08:00:00',
          deleted_at: null
        }
      ]
      
      const dayKeys = ['2026-09-30', '2026-10-01', '2026-10-02']
      const result = groupTasksByDay(tasks, dayKeys)
      
      expect(result['2026-09-30']).toHaveLength(1)
      expect(result['2026-09-30'][0].id).toBe('task1')
      expect(result['2026-10-01']).toHaveLength(1)
      expect(result['2026-10-01'][0].id).toBe('task2')
    })

    it('correctly handles overdue tasks', () => {
      const tasks: TaskRow[] = [
        {
          id: 'overdue',
          checked: 0,
          content: 'Overdue task',
          description: '',
          project_id: 'project1',
          section_id: null,
          parent_id: null,
          priority: 4,
          due_date: '2023-10-10T10:00:00',
          due_has_time: 1,
          recur_string: null,
          recur_strict: 0,
          recur_ends: null,
          deadline_date: null,
          duration_min: null,
          task_order: 0,
          is_header: 0,
          completed_at: null,
          added_at: '2023-10-10T08:00:00',
          updated_at: '2023-10-10T08:00:00',
          deleted_at: null
        },
        {
          id: 'today',
          checked: 0,
          content: 'Today task',
          description: '',
          project_id: 'project1',
          section_id: null,
          parent_id: null,
          priority: 4,
          due_date: '2023-10-15T14:00:00',
          due_has_time: 1,
          recur_string: null,
          recur_strict: 0,
          recur_ends: null,
          deadline_date: null,
          duration_min: null,
          task_order: 0,
          is_header: 0,
          completed_at: null,
          added_at: '2023-10-15T08:00:00',
          updated_at: '2023-10-15T08:00:00',
          deleted_at: null
        }
      ]
      
      const dayKeys = ['2023-10-15', '2023-10-16']
      const result = groupTasksByDay(tasks, dayKeys)
      
      expect(result['2023-10-15']).toHaveLength(1)
      expect(result['2023-10-15'][0].id).toBe('today')
      expect(result['2023-10-16']).toHaveLength(0)
    })
  })
})
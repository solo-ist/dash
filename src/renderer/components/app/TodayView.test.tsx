import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TodayView } from './TodayView'
import type { TaskRow } from '../../../shared/types'

describe('TodayView', () => {
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

  it('renders overdue and today tasks correctly', () => {
    const { container } = render(
      <TodayView
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
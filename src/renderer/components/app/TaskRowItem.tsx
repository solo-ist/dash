import { useState } from 'react'
import { Checkbox } from '../ui/checkbox'
import { cn } from '../../lib/utils'
import { todayLocalDate, isOverdue, datePart } from '../../lib/dates'
import type { TaskRow } from '../../../shared/types'

interface TaskRowItemProps {
  task: TaskRow
  selected: boolean
  onSelect: () => void
  onComplete: () => void
  onDelete: () => void
  onMove: (targetIndex: number, scope?: { projectId?: string; sectionId?: string }) => void
}

export function TaskRowItem({
  task,
  selected,
  onSelect,
  onComplete,
  onDelete,
  onMove
}: TaskRowItemProps): React.JSX.Element {
  const today = todayLocalDate()
  const isOverdueTask = isOverdue(task.due_date!, today)
  const isTodayTask = datePart(task.due_date!) === today
  
  const handleCheckboxChange = (checked: boolean) => {
    if (checked) {
      onComplete()
    } else {
      // For uncompleting tasks, we'll implement in a separate issue
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent',
        selected && 'bg-accent',
        task.checked === 1 && 'opacity-60'
      )}
      onClick={onSelect}
    >
      <Checkbox
        checked={task.checked === 1}
        onCheckedChange={handleCheckboxChange}
        className="shrink-0"
        aria-label={task.checked === 1 ? 'Uncomplete task' : 'Complete task'}
      />
      <div className="flex-1 min-w-0">
        <span className={cn(task.checked === 1 && 'line-through', isOverdueTask && 'text-red-500')}>
          {task.content}
        </span>
        {task.due_date && (
          <span className={cn('ml-2 text-xs', isOverdueTask ? 'text-red-500' : 'text-muted-foreground')}>
            {isTodayTask ? 'Today' : datePart(task.due_date)}
          </span>
        )}
      </div>
    </div>
  )
}
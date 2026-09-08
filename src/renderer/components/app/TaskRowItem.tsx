import { Checkbox } from '../ui/checkbox'
import { cn } from '../../lib/utils'
import { todayLocalDate, isOverdue, datePart } from '../../lib/dates'
import type { LabelRow, TaskRow } from '../../../shared/types'
import type { SubtaskCounts, TaskMoveScope } from '../../stores/taskStore'

export type DropPosition = 'before' | 'after'

interface TaskRowItemProps {
  task: TaskRow
  depth?: number
  subtaskCount?: SubtaskCounts
  labels?: LabelRow[]
  selected: boolean
  dropIndicator?: DropPosition | null
  onSelect?: (id: string) => void
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onMove?: (id: string, targetIndex: number, scope?: TaskMoveScope) => void
  onDragStartRow?: (id: string) => void
  onDragOverRow?: (id: string, position: DropPosition) => void
  onDropRow?: (id: string) => void
  onDragEndRow?: () => void
}

export function TaskRowItem({
  task,
  depth = 0,
  subtaskCount,
  labels,
  selected,
  dropIndicator = null,
  onSelect,
  onComplete,
  onDelete,
  onDragStartRow,
  onDragOverRow,
  onDropRow,
  onDragEndRow
}: TaskRowItemProps): React.JSX.Element {
  const today = todayLocalDate()
  const isOverdueTask = task.due_date !== null && isOverdue(task.due_date, today)
  const isTodayTask = task.due_date !== null && datePart(task.due_date) === today
  const isDeadlinePast = task.deadline_date !== null && datePart(task.deadline_date) < today

  function handleCheckboxChange(checked: boolean): void {
    if (checked) onComplete(task.id)
  }

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent',
        selected && 'bg-accent',
        task.checked === 1 && 'opacity-60'
      )}
      style={depth > 0 ? { paddingLeft: `${8 + depth * 16}px` } : undefined}
      draggable={onDragStartRow !== undefined}
      onClick={() => onSelect?.(task.id)}
      onDragStart={(event) => {
        event.stopPropagation()
        onDragStartRow?.(task.id)
      }}
      onDragOver={(event) => {
        if (onDragOverRow === undefined) return
        event.preventDefault()
        event.stopPropagation()
        const rect = event.currentTarget.getBoundingClientRect()
        const isTopHalf = event.clientY < rect.top + rect.height / 2
        onDragOverRow(task.id, isTopHalf ? 'before' : 'after')
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onDropRow?.(task.id)
      }}
      onDragEnd={() => onDragEndRow?.()}
    >
      {dropIndicator === 'before' && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-primary" />
      )}
      <Checkbox
        checked={task.checked === 1}
        onCheckedChange={handleCheckboxChange}
        className="shrink-0"
        aria-label={task.checked === 1 ? 'Uncomplete task' : 'Complete task'}
      />
      <div className="min-w-0 flex-1">
        <span className={cn(task.checked === 1 && 'line-through', isOverdueTask && 'text-red-500')}>
          {task.content}
        </span>
        {task.due_date !== null && (
          <span className={cn('ml-2 text-xs', isOverdueTask ? 'text-red-500' : 'text-muted-foreground')}>
            {isTodayTask ? 'Today' : datePart(task.due_date)}
          </span>
        )}
        {task.deadline_date !== null && (
          <span
            className={cn(
              'ml-2 inline-flex items-center gap-0.5 rounded-sm border px-1 text-xs',
              isDeadlinePast ? 'border-destructive text-destructive' : 'border-border text-muted-foreground'
            )}
          >
            ◆ {datePart(task.deadline_date)}
          </span>
        )}
        {task.duration_min !== null && (
          <span className="ml-2 text-xs text-muted-foreground">{task.duration_min} min</span>
        )}
        {subtaskCount !== undefined && subtaskCount.total > 0 && (
          <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {subtaskCount.completed}/{subtaskCount.total}
          </span>
        )}
        {labels !== undefined && labels.length > 0 && (
          <span className="ml-2 inline-flex items-center gap-1">
            {labels.map((label) => (
              <span key={label.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: label.color }} />
            ))}
          </span>
        )}
      </div>
      <button
        type="button"
        aria-label="Delete task"
        onClick={(event) => {
          event.stopPropagation()
          onDelete(task.id)
        }}
        className="shrink-0 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
      >
        ×
      </button>
      {dropIndicator === 'after' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
      )}
    </div>
  )
}

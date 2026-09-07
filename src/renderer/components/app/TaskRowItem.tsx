import { cn } from '../../lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '../ui/context-menu'
import type { LabelRow, TaskRow } from '../../../shared/types'

const PRIORITY_RING: Record<number, string> = {
  1: 'border-red-400 text-red-400',
  2: 'border-orange-400 text-orange-400',
  3: 'border-blue-400 text-blue-400',
  4: 'border-muted-foreground text-muted-foreground'
}

function priorityRing(priority: number): string {
  return PRIORITY_RING[priority] ?? PRIORITY_RING[4]
}

const MAX_INDENT_DEPTH = 3

const DEPTH_PADDING: Record<number, string> = {
  0: 'pl-4',
  1: 'pl-8',
  2: 'pl-12',
  3: 'pl-16'
}

export type DropPosition = 'before' | 'after'

export interface TaskRowItemProps {
  task: TaskRow
  labels?: LabelRow[]
  selected?: boolean
  depth?: number
  subtaskCount?: { total: number; completed: number }
  dropIndicator?: DropPosition | null
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onSelect?: (id: string) => void
  onDragStartRow?: (id: string) => void
  onDragOverRow?: (id: string, position: DropPosition) => void
  onDropRow?: (id: string) => void
  onDragEndRow?: () => void
}

export function TaskRowItem({
  task,
  labels = [],
  selected = false,
  depth = 0,
  subtaskCount,
  dropIndicator = null,
  onComplete,
  onDelete,
  onSelect,
  onDragStartRow,
  onDragOverRow,
  onDropRow,
  onDragEndRow
}: TaskRowItemProps): React.JSX.Element {
  const indentClass = DEPTH_PADDING[Math.min(depth, MAX_INDENT_DEPTH)]

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="relative"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData('text/plain', task.id)
            event.dataTransfer.effectAllowed = 'move'
            onDragStartRow?.(task.id)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            const rect = event.currentTarget.getBoundingClientRect()
            const isTopHalf = event.clientY < rect.top + rect.height / 2
            onDragOverRow?.(task.id, isTopHalf ? 'before' : 'after')
          }}
          onDrop={(event) => {
            event.preventDefault()
            onDropRow?.(task.id)
          }}
          onDragEnd={() => onDragEndRow?.()}
        >
          {dropIndicator === 'before' && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-primary" />
          )}
          <div
            onClick={() => onSelect?.(task.id)}
            className={cn(
              'flex items-center gap-3 border-b border-border py-2.5 pr-4 last:border-b-0',
              indentClass,
              selected && 'bg-accent'
            )}
          >
            <button
              type="button"
              aria-label="Complete task"
              onClick={(event) => {
                event.stopPropagation()
                onComplete(task.id)
              }}
              className={cn(
                'h-4 w-4 shrink-0 rounded-full border-2 transition-colors hover:bg-accent',
                priorityRing(task.priority)
              )}
            />
            <span className="flex-1 truncate text-sm text-foreground">{task.content}</span>
            {subtaskCount !== undefined && subtaskCount.total > 0 && (
              <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {subtaskCount.completed}/{subtaskCount.total}
              </span>
            )}
            {task.due_date !== null && (
              <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {task.due_date}
              </span>
            )}
            {labels.map((label) => (
              <span
                key={label.id}
                className="flex shrink-0 items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                {label.name}
              </span>
            ))}
          </div>
          {dropIndicator === 'after' && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-0.5 bg-primary" />
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem className="text-destructive" onSelect={() => onDelete(task.id)}>
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

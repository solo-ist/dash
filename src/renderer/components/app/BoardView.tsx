import { useState } from 'react'
import { cn } from '../../lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '../ui/context-menu'
import { computeDropIndex } from './TaskList'
import type { DropPosition } from './TaskRowItem'
import { selectBoardColumns, type BoardColumn } from '../../stores/boardSelectors'
import type { TaskMoveScope } from '../../stores/taskStore'
import { todayLocalDate, datePart } from '../../lib/dates'
import type { SectionRow, TaskRow } from '../../../shared/types'

const PRIORITY_RING: Record<number, string> = {
  1: 'border-red-400 text-red-400',
  2: 'border-orange-400 text-orange-400',
  3: 'border-blue-400 text-blue-400',
  4: 'border-muted-foreground text-muted-foreground'
}

function priorityRing(priority: number): string {
  return PRIORITY_RING[priority] ?? PRIORITY_RING[4]
}

type DropTarget = { sectionId: string | null } & (
  | { kind: 'card'; id: string; position: DropPosition }
  | { kind: 'column' }
)

type DropPositionInColumn = { kind: 'card'; id: string; position: DropPosition } | { kind: 'column' }

interface BoardCardProps {
  task: TaskRow
  subtaskCount?: number
  selected: boolean
  dropIndicator: DropPosition | null
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onSelect?: (id: string) => void
  onDragStartCard: (id: string) => void
  onDragOverCard: (id: string, position: DropPosition) => void
  onDropCard: (id: string) => void
  onDragEndCard: () => void
}

function BoardCard({
  task,
  subtaskCount,
  selected,
  dropIndicator,
  onComplete,
  onDelete,
  onSelect,
  onDragStartCard,
  onDragOverCard,
  onDropCard,
  onDragEndCard
}: BoardCardProps): React.JSX.Element {
  const today = todayLocalDate()
  const isDeadlinePast = task.deadline_date !== null && datePart(task.deadline_date) < today

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="relative"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData('text/plain', task.id)
            event.dataTransfer.effectAllowed = 'move'
            event.stopPropagation()
            onDragStartCard(task.id)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            event.stopPropagation()
            const rect = event.currentTarget.getBoundingClientRect()
            const isTopHalf = event.clientY < rect.top + rect.height / 2
            onDragOverCard(task.id, isTopHalf ? 'before' : 'after')
          }}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onDropCard(task.id)
          }}
          onDragEnd={() => onDragEndCard()}
        >
          {dropIndicator === 'before' && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-primary" />
          )}
          <div
            onClick={() => onSelect?.(task.id)}
            className={cn(
              'mb-2 flex flex-col gap-2 rounded-md border border-border bg-card p-2.5 text-sm shadow-sm hover:border-muted-foreground/40',
              selected && 'border-primary bg-accent'
            )}
          >
            <div className="flex items-start gap-2">
              <button
                type="button"
                aria-label="Complete task"
                onClick={(event) => {
                  event.stopPropagation()
                  onComplete(task.id)
                }}
                className={cn(
                  'mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors hover:bg-accent',
                  priorityRing(task.priority)
                )}
              />
              <span className="flex-1 text-foreground">{task.content}</span>
            </div>
            {(subtaskCount !== undefined && subtaskCount > 0) ||
            task.deadline_date !== null ||
            task.duration_min !== null ? (
              <div className="flex flex-wrap items-center gap-1">
                {subtaskCount !== undefined && subtaskCount > 0 && (
                  <span className="w-fit shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {subtaskCount} subtask{subtaskCount === 1 ? '' : 's'}
                  </span>
                )}
                {task.deadline_date !== null && (
                  <span
                    className={cn(
                      'inline-flex w-fit shrink-0 items-center gap-0.5 rounded-sm border px-1 text-xs',
                      isDeadlinePast ? 'border-destructive text-destructive' : 'border-border text-muted-foreground'
                    )}
                  >
                    ◆ {datePart(task.deadline_date)}
                  </span>
                )}
                {task.duration_min !== null && (
                  <span className="w-fit shrink-0 text-xs text-muted-foreground">{task.duration_min} min</span>
                )}
              </div>
            ) : null}
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

export interface BoardViewProps {
  tasks: TaskRow[]
  sections: SectionRow[]
  projectId: string
  selectedTaskId?: string | null
  subtaskCounts?: Record<string, number>
  onSelect?: (id: string) => void
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onMove?: (id: string, targetIndex: number, scope?: TaskMoveScope) => void
}

export function BoardView({
  tasks,
  sections,
  projectId,
  selectedTaskId = null,
  subtaskCounts = {},
  onSelect,
  onComplete,
  onDelete,
  onMove
}: BoardViewProps): React.JSX.Element {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  const columns = selectBoardColumns(tasks, sections, projectId)

  function handleDrop(column: BoardColumn, position: DropPositionInColumn): void {
    const activeDraggingId = draggingId
    setDraggingId(null)
    setDropTarget(null)
    if (activeDraggingId === null || onMove === undefined) return
    if (position.kind === 'card' && position.id === activeDraggingId) return

    const dragged = tasks.find((task) => task.id === activeDraggingId)
    if (dragged === undefined) return

    const siblingIds = column.tasks.map((task) => task.id)
    const targetIndex =
      position.kind === 'card'
        ? computeDropIndex(siblingIds, activeDraggingId, position.id, position.position)
        : siblingIds.filter((id) => id !== activeDraggingId).length

    const scope: TaskMoveScope | undefined =
      dragged.section_id === column.sectionId ? undefined : { sectionId: column.sectionId }
    onMove(activeDraggingId, targetIndex, scope)
  }

  function handleDragEnd(): void {
    setDraggingId(null)
    setDropTarget(null)
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-3">
      {columns.map((column) => (
        <div
          key={column.sectionId ?? 'no-section'}
          className={cn(
            'flex h-full w-72 shrink-0 flex-col rounded-md border border-border bg-muted/20',
            dropTarget?.sectionId === column.sectionId && dropTarget.kind === 'column' && 'ring-1 ring-primary'
          )}
          onDragOver={(event) => {
            if (draggingId === null) return
            event.preventDefault()
            setDropTarget({ sectionId: column.sectionId, kind: 'column' })
          }}
          onDrop={(event) => {
            event.preventDefault()
            handleDrop(column, { kind: 'column' })
          }}
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="flex-1 truncate text-xs font-medium uppercase text-muted-foreground">
              {column.sectionId === null
                ? 'No section'
                : sections.find((section) => section.id === column.sectionId)?.name ?? ''}
              <span className="normal-case"> ({column.tasks.length})</span>
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {column.tasks.map((task) => (
              <BoardCard
                key={task.id}
                task={task}
                subtaskCount={subtaskCounts[task.id]}
                selected={task.id === selectedTaskId}
                dropIndicator={
                  dropTarget?.sectionId === column.sectionId && dropTarget.kind === 'card' && dropTarget.id === task.id
                    ? dropTarget.position
                    : null
                }
                onComplete={onComplete}
                onDelete={onDelete}
                onSelect={onSelect}
                onDragStartCard={setDraggingId}
                onDragOverCard={(id, position) => {
                  if (draggingId === null || draggingId === id) return
                  setDropTarget({ sectionId: column.sectionId, kind: 'card', id, position })
                }}
                onDropCard={(targetId) => {
                  const position =
                    dropTarget?.kind === 'card' && dropTarget.id === targetId ? dropTarget.position : 'before'
                  handleDrop(column, { kind: 'card', id: targetId, position })
                }}
                onDragEndCard={handleDragEnd}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

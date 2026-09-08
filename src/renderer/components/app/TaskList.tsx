import { useState } from 'react'
import { ScrollArea } from '../ui/scroll-area'
import { Input } from '../ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { TaskRowItem, type DropPosition } from './TaskRowItem'
import { nestTasksByParent, subtaskCounts, type TaskMoveScope } from '../../stores/taskStore'
import type { LabelRow, SectionRow, TaskRow } from '../../../shared/types'

// Given the ordered ids of a single ordering scope (siblings sharing the
// same project/section/parent, INCLUDING the dragged task), compute the
// task.move `targetIndex` for dropping `draggingId` at `position` relative
// to `targetId`. Mirrors how src/main/mutate.ts's task.move handler
// interprets targetIndex: an index into the sibling list with the dragged
// task removed.
export function computeDropIndex(
  siblingIds: string[],
  draggingId: string,
  targetId: string,
  position: DropPosition
): number {
  const remaining = siblingIds.filter((id) => id !== draggingId)
  const targetPos = remaining.indexOf(targetId)
  if (targetPos === -1) return remaining.length
  return position === 'before' ? targetPos : targetPos + 1
}

// The ordered ids of the tasks sharing `parentId`/`sectionId` within
// `tasks` (already in task_order display order) - i.e. one task.move
// ordering scope as rendered in the list.
function siblingScopeIds(tasks: TaskRow[], parentId: string | null, sectionId: string | null): string[] {
  return tasks
    .filter((task) => task.parent_id === parentId && task.section_id === sectionId)
    .map((task) => task.id)
}

export interface TaskListProps {
  tasks: TaskRow[]
  sections: SectionRow[]
  error: string | null
  selectedTaskId?: string | null
  labelsByTaskId?: Record<string, LabelRow[]>
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onSelect?: (id: string) => void
  onMove?: (id: string, targetIndex: number, scope?: TaskMoveScope) => void
  onAddSection: (name: string) => void
  onRenameSection: (id: string, name: string) => void
  onArchiveSection: (id: string) => void
  onDeleteSection: (id: string) => void
}

function SectionHeader({
  section,
  count,
  onRename,
  onArchive,
  onDelete
}: {
  section: SectionRow
  count: number
  onRename: (id: string, name: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(section.name)

  function commit(): void {
    setEditing(false)
    const trimmed = name.trim()
    if (trimmed.length > 0 && trimmed !== section.name) {
      onRename(section.id, trimmed)
    } else {
      setName(section.name)
    }
  }

  return (
    <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-1.5">
      {editing ? (
        <Input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            }
            if (event.key === 'Escape') {
              setName(section.name)
              setEditing(false)
            }
          }}
          className="h-7 max-w-xs text-xs"
        />
      ) : (
        <span className="flex-1 truncate text-xs font-medium uppercase text-muted-foreground">
          {section.name} <span className="normal-case">({count})</span>
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger className="text-xs text-muted-foreground hover:text-foreground">
          ⋯
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>Rename</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onArchive(section.id)}>Archive</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onSelect={() => onDelete(section.id)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function TaskList({
  tasks,
  sections,
  error,
  selectedTaskId = null,
  labelsByTaskId = {},
  onComplete,
  onDelete,
  onSelect,
  onMove,
  onAddSection,
  onRenameSection,
  onArchiveSection,
  onDeleteSection
}: TaskListProps): React.JSX.Element {
  const [addingSection, setAddingSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; position: DropPosition } | null>(null)

  function commitAddSection(): void {
    const trimmed = newSectionName.trim()
    if (trimmed.length > 0) onAddSection(trimmed)
    setNewSectionName('')
    setAddingSection(false)
  }

  function handleDragOverRow(id: string, position: DropPosition): void {
    if (draggingId === null || draggingId === id) return
    setDropTarget({ id, position })
  }

  function handleDropRow(targetId: string): void {
    const activeDraggingId = draggingId
    const position = dropTarget?.id === targetId ? dropTarget.position : 'before'
    setDraggingId(null)
    setDropTarget(null)
    if (activeDraggingId === null || activeDraggingId === targetId || onMove === undefined) return

    const dragged = tasks.find((task) => task.id === activeDraggingId)
    const target = tasks.find((task) => task.id === targetId)
    if (dragged === undefined || target === undefined || dragged.parent_id !== target.parent_id) return

    const siblingIds = siblingScopeIds(tasks, target.parent_id, target.section_id)
    const targetIndex = computeDropIndex(siblingIds, activeDraggingId, targetId, position)
    const scope: TaskMoveScope | undefined =
      dragged.section_id === target.section_id ? undefined : { sectionId: target.section_id }
    onMove(activeDraggingId, targetIndex, scope)
  }

  function handleDragEndRow(): void {
    setDraggingId(null)
    setDropTarget(null)
  }

  const unsectioned = tasks.filter((task) => task.section_id === null)

  return (
    <div className="flex h-full flex-col">
      {error !== null && (
        <p className="px-4 py-2 text-xs text-destructive/80">{error}</p>
      )}
      {tasks.length === 0 && sections.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No tasks — press q to add</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          {sections.length === 0 ? (
            nestTasksByParent(tasks).map(({ task, depth }) => (
              <TaskRowItem
                key={task.id}
                task={task}
                depth={depth}
                subtaskCount={subtaskCounts(tasks, task.id)}
                labels={labelsByTaskId[task.id]}
                selected={task.id === selectedTaskId}
                dropIndicator={dropTarget?.id === task.id ? dropTarget.position : null}
                onComplete={onComplete}
                onDelete={onDelete}
                onSelect={onSelect}
                onDragStartRow={setDraggingId}
                onDragOverRow={handleDragOverRow}
                onDropRow={handleDropRow}
                onDragEndRow={handleDragEndRow}
              />
            ))
          ) : (
            <>
              {nestTasksByParent(unsectioned).map(({ task, depth }) => (
                <TaskRowItem
                  key={task.id}
                  task={task}
                  depth={depth}
                  subtaskCount={subtaskCounts(tasks, task.id)}
                  labels={labelsByTaskId[task.id]}
                  selected={task.id === selectedTaskId}
                  dropIndicator={dropTarget?.id === task.id ? dropTarget.position : null}
                  onComplete={onComplete}
                  onDelete={onDelete}
                  onSelect={onSelect}
                  onDragStartRow={setDraggingId}
                  onDragOverRow={handleDragOverRow}
                  onDropRow={handleDropRow}
                  onDragEndRow={handleDragEndRow}
                />
              ))}
              {sections.map((section) => {
                const sectionTasks = tasks.filter((task) => task.section_id === section.id)
                return (
                  <div key={section.id}>
                    <SectionHeader
                      section={section}
                      count={sectionTasks.length}
                      onRename={onRenameSection}
                      onArchive={onArchiveSection}
                      onDelete={onDeleteSection}
                    />
                    {nestTasksByParent(sectionTasks).map(({ task, depth }) => (
                      <TaskRowItem
                        key={task.id}
                        task={task}
                        depth={depth}
                        subtaskCount={subtaskCounts(tasks, task.id)}
                        labels={labelsByTaskId[task.id]}
                        selected={task.id === selectedTaskId}
                        dropIndicator={dropTarget?.id === task.id ? dropTarget.position : null}
                        onComplete={onComplete}
                        onDelete={onDelete}
                        onSelect={onSelect}
                        onDragStartRow={setDraggingId}
                        onDragOverRow={handleDragOverRow}
                        onDropRow={handleDropRow}
                        onDragEndRow={handleDragEndRow}
                      />
                    ))}
                  </div>
                )
              })}
            </>
          )}
        </ScrollArea>
      )}
      <div className="border-t border-border px-4 py-2">
        {addingSection ? (
          <Input
            autoFocus
            placeholder="Section name"
            value={newSectionName}
            onChange={(event) => setNewSectionName(event.target.value)}
            onBlur={commitAddSection}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitAddSection()
              }
              if (event.key === 'Escape') {
                setNewSectionName('')
                setAddingSection(false)
              }
            }}
            className="h-8 max-w-xs text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingSection(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            + Add section
          </button>
        )}
      </div>
    </div>
  )
}

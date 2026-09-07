import { useState } from 'react'
import { ScrollArea } from '../ui/scroll-area'
import { Input } from '../ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { TaskRowItem } from './TaskRowItem'
import { nestTasksByParent, subtaskCounts } from '../../stores/taskStore'
import type { SectionRow, TaskRow } from '../../../shared/types'

export interface TaskListProps {
  tasks: TaskRow[]
  sections: SectionRow[]
  error: string | null
  selectedTaskId?: string | null
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onSelect?: (id: string) => void
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
  onComplete,
  onDelete,
  onSelect,
  onAddSection,
  onRenameSection,
  onArchiveSection,
  onDeleteSection
}: TaskListProps): React.JSX.Element {
  const [addingSection, setAddingSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')

  function commitAddSection(): void {
    const trimmed = newSectionName.trim()
    if (trimmed.length > 0) onAddSection(trimmed)
    setNewSectionName('')
    setAddingSection(false)
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
                selected={task.id === selectedTaskId}
                onComplete={onComplete}
                onDelete={onDelete}
                onSelect={onSelect}
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
                  selected={task.id === selectedTaskId}
                  onComplete={onComplete}
                  onDelete={onDelete}
                  onSelect={onSelect}
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
                        selected={task.id === selectedTaskId}
                        onComplete={onComplete}
                        onDelete={onDelete}
                        onSelect={onSelect}
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

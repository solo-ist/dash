import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { cn } from '../../lib/utils'
import { parseBlocks, type BlockToken, type InlineToken } from '../../lib/markdown'
import type { LabelRow, ReminderRow, TaskRow } from '../../../shared/types'
import type { TaskUpdatePatch } from '../../stores/taskStore'
import type { ReminderAddInput } from '../../stores/reminderStore'

const REMINDER_PRESETS_MIN = [0, 10, 30, 60]

const PRIORITY_TEXT: Record<number, string> = {
  1: 'text-red-500',
  2: 'text-orange-500',
  3: 'text-blue-500',
  4: 'text-muted-foreground'
}

function priorityColor(priority: number): string {
  return PRIORITY_TEXT[priority] ?? PRIORITY_TEXT[4]
}

const PRIORITY_BORDER: Record<number, string> = {
  1: 'border-red-500',
  2: 'border-orange-500',
  3: 'border-blue-500',
  4: 'border-muted-foreground'
}

function priorityBorder(priority: number): string {
  return PRIORITY_BORDER[priority] ?? PRIORITY_BORDER[4]
}

export interface TaskDetailPanelProps {
  task: TaskRow
  projectName: string
  sectionName: string | null
  // Full task list, used to derive the sub-tasks section and parent breadcrumb.
  // Optional/defaulted so callers that don't yet pass it still render correctly.
  tasks?: TaskRow[]
  onUpdate: (patch: TaskUpdatePatch) => void
  onClose: () => void
  onComplete: (id: string) => void
  onUncomplete?: (id: string) => void
  onDelete: (id: string) => void
  onSelectTask?: (id: string) => void
  onAddSubtask?: (parentId: string, content: string) => void
  allLabels?: LabelRow[]
  assignedLabels?: LabelRow[]
  onSetLabels?: (taskId: string, labelIds: string[]) => void
  taskReminders?: ReminderRow[]
  onAddReminder?: (input: ReminderAddInput) => void
  onDeleteReminder?: (id: string) => void
}

function InlineTokens({ tokens }: { tokens: InlineToken[] }): React.JSX.Element {
  return (
    <>
      {tokens.map((token, index) => {
        switch (token.kind) {
          case 'bold':
            return <strong key={index}>{token.text}</strong>
          case 'italic':
            return <em key={index}>{token.text}</em>
          case 'code':
            return (
              <code key={index} className="rounded-sm bg-muted px-1 py-0.5 text-xs">
                {token.text}
              </code>
            )
          case 'link':
            return (
              <a
                key={index}
                href={token.href}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2"
              >
                {token.text}
              </a>
            )
          default:
            return <span key={index}>{token.text}</span>
        }
      })}
    </>
  )
}

function MarkdownBlock({ block, index }: { block: BlockToken; index: number }): React.JSX.Element {
  if (block.kind === 'heading') {
    const HEADING_CLASS: Record<1 | 2 | 3, string> = {
      1: 'text-lg font-semibold',
      2: 'text-base font-semibold',
      3: 'text-sm font-semibold'
    }
    if (block.level === 1) {
      return (
        <h1 key={index} className={HEADING_CLASS[1]}>
          <InlineTokens tokens={block.inline} />
        </h1>
      )
    }
    if (block.level === 2) {
      return (
        <h2 key={index} className={HEADING_CLASS[2]}>
          <InlineTokens tokens={block.inline} />
        </h2>
      )
    }
    return (
      <h3 key={index} className={HEADING_CLASS[3]}>
        <InlineTokens tokens={block.inline} />
      </h3>
    )
  }

  if (block.kind === 'list') {
    return (
      <ul key={index} className="list-disc space-y-0.5 pl-5">
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>
            <InlineTokens tokens={item} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <p key={index}>
      <InlineTokens tokens={block.inline} />
    </p>
  )
}

function MarkdownView({ markdown }: { markdown: string }): React.JSX.Element {
  const blocks = parseBlocks(markdown)
  return (
    <div className="space-y-2 text-sm text-foreground">
      {blocks.map((block, index) => (
        <MarkdownBlock key={index} block={block} index={index} />
      ))}
    </div>
  )
}

export function TaskDetailPanel({
  task,
  projectName,
  sectionName,
  tasks = [],
  onUpdate,
  onClose,
  onComplete,
  onUncomplete,
  onDelete,
  onSelectTask,
  onAddSubtask,
  allLabels = [],
  assignedLabels = [],
  onSetLabels,
  taskReminders = [],
  onAddReminder,
  onDeleteReminder
}: TaskDetailPanelProps): React.JSX.Element {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(task.content)
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState(task.description)
  const [newSubtaskContent, setNewSubtaskContent] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [reminderTime, setReminderTime] = useState('')

  const parentTask =
    task.parent_id !== null ? tasks.find((candidate) => candidate.id === task.parent_id) ?? null : null
  const children = tasks.filter((candidate) => candidate.parent_id === task.id && candidate.deleted_at === null)

  function toggleChild(child: TaskRow): void {
    if (child.checked === 1) {
      onUncomplete?.(child.id)
    } else {
      onComplete(child.id)
    }
  }

  function toggleLabel(labelId: string): void {
    const assignedIds = assignedLabels.map((label) => label.id)
    const nextIds = assignedIds.includes(labelId)
      ? assignedIds.filter((id) => id !== labelId)
      : [...assignedIds, labelId]
    onSetLabels?.(task.id, nextIds)
  }

  function addRelativeReminder(minuteOffset: number): void {
    onAddReminder?.({ taskId: task.id, kind: 'relative', minuteOffset })
  }

  function commitAddAbsoluteReminder(): void {
    if (reminderDate.length > 0 && reminderTime.length > 0) {
      onAddReminder?.({ taskId: task.id, kind: 'absolute', at: `${reminderDate} ${reminderTime}` })
      setReminderDate('')
      setReminderTime('')
    }
  }

  function commitAddSubtask(): void {
    const trimmed = newSubtaskContent.trim()
    if (trimmed.length > 0) onAddSubtask?.(task.id, trimmed)
    setNewSubtaskContent('')
  }

  function startEditingTitle(): void {
    setTitleDraft(task.content)
    setEditingTitle(true)
  }

  function commitTitle(): void {
    setEditingTitle(false)
    const trimmed = titleDraft.trim()
    if (trimmed.length > 0 && trimmed !== task.content) {
      onUpdate({ content: trimmed })
    } else {
      setTitleDraft(task.content)
    }
  }

  function cancelTitle(): void {
    setTitleDraft(task.content)
    setEditingTitle(false)
  }

  function startEditingDescription(): void {
    setDescriptionDraft(task.description)
    setEditingDescription(true)
  }

  function commitDescription(): void {
    setEditingDescription(false)
    if (descriptionDraft !== task.description) {
      onUpdate({ description: descriptionDraft })
    }
  }

  function cancelDescription(): void {
    setDescriptionDraft(task.description)
    setEditingDescription(false)
  }

  function handleDescriptionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Escape') {
      cancelDescription()
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      commitDescription()
    }
  }

  return (
    <div className="flex h-full w-80 max-w-sm shrink-0 flex-col border-l border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="truncate text-xs text-muted-foreground">
          {sectionName !== null ? `${projectName} › ${sectionName}` : projectName}
        </span>
        <button
          type="button"
          aria-label="Close panel"
          onClick={onClose}
          className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {parentTask !== null && (
          <button
            type="button"
            onClick={() => onSelectTask?.(parentTask.id)}
            className="block truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            {parentTask.content}
          </button>
        )}
        <div>
          {editingTitle ? (
            <Input
              autoFocus
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitTitle()
                }
                if (event.key === 'Escape') {
                  cancelTitle()
                }
              }}
              className="text-sm font-medium"
            />
          ) : (
            <button
              type="button"
              onClick={startEditingTitle}
              className="w-full rounded-sm px-1 py-0.5 text-left text-sm font-medium text-foreground hover:bg-accent"
            >
              {task.content}
            </button>
          )}
        </div>

        <div>
          {editingDescription ? (
            <Textarea
              autoFocus
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
              onBlur={commitDescription}
              onKeyDown={handleDescriptionKeyDown}
              className="min-h-[100px] text-sm"
            />
          ) : task.description.trim().length > 0 ? (
            <div
              role="button"
              tabIndex={0}
              onClick={startEditingDescription}
              onKeyDown={(event) => {
                if (event.key === 'Enter') startEditingDescription()
              }}
              className="w-full cursor-text rounded-sm px-1 py-0.5 text-left hover:bg-accent"
            >
              <MarkdownView markdown={task.description} />
            </div>
          ) : (
            <button
              type="button"
              onClick={startEditingDescription}
              className="w-full rounded-sm px-1 py-0.5 text-left text-sm text-muted-foreground hover:bg-accent"
            >
              Add description…
            </button>
          )}
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Priority</span>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn('text-sm font-medium hover:underline', priorityColor(task.priority))}
              >
                P{task.priority}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {[1, 2, 3, 4].map((level) => (
                  <DropdownMenuItem
                    key={level}
                    className={priorityColor(level)}
                    onSelect={() => onUpdate({ priority: level as 1 | 2 | 3 | 4 })}
                  >
                    P{level}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Due date</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={task.due_date ? task.due_date.substring(0, 10) : ''}
                onChange={(e) => {
                  const newDate = e.target.value
                  if (newDate) {
                    onUpdate({ dueDate: newDate, dueHasTime: false })
                  } else {
                    onUpdate({ dueDate: null, dueHasTime: false })
                  }
                }}
                className="h-5 w-24 rounded border border-border bg-transparent px-1 py-0 text-sm text-foreground"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => onUpdate({ dueDate: null, dueHasTime: false })}
                aria-label="Clear due date"
              >
                ×
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Deadline</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={task.deadline_date ? task.deadline_date.substring(0, 10) : ''}
                onChange={(e) => {
                  const newDate = e.target.value
                  onUpdate({ deadlineDate: newDate.length > 0 ? newDate : null })
                }}
                className="h-5 w-24 rounded border border-border bg-transparent px-1 py-0 text-sm text-foreground"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => onUpdate({ deadlineDate: null })}
                aria-label="Clear deadline"
              >
                ×
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Duration</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                step={1}
                value={task.duration_min ?? ''}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw.trim().length === 0) {
                    onUpdate({ durationMin: null })
                    return
                  }
                  const parsed = Number.parseInt(raw, 10)
                  if (Number.isInteger(parsed) && parsed > 0) {
                    onUpdate({ durationMin: parsed })
                  }
                }}
                className="h-5 w-14 rounded border border-border bg-transparent px-1 py-0 text-sm text-foreground"
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Labels</span>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex flex-wrap items-center justify-end gap-1 text-sm hover:underline">
                {assignedLabels.length > 0 ? (
                  assignedLabels.map((label) => (
                    <span
                      key={label.id}
                      className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground">Add labels…</span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {allLabels.map((label) => (
                  <DropdownMenuCheckboxItem
                    key={label.id}
                    checked={assignedLabels.some((assigned) => assigned.id === label.id)}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={() => toggleLabel(label.id)}
                  >
                    {label.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-1.5 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">Reminders</span>
          {taskReminders.map((reminder) => (
            <div key={reminder.id} className="flex items-center justify-between">
              <span className="text-sm text-foreground">
                {reminder.kind === 'relative'
                  ? reminder.minute_offset === 0
                    ? 'At due time'
                    : `${reminder.minute_offset ?? 0} min before due`
                  : reminder.at}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-destructive"
                onClick={() => onDeleteReminder?.(reminder.id)}
                aria-label="Delete reminder"
              >
                ×
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-1">
            {REMINDER_PRESETS_MIN.map((minutes) => (
              <Button
                key={minutes}
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                disabled={task.due_date === null}
                onClick={() => addRelativeReminder(minutes)}
              >
                {minutes === 0 ? 'At due time' : `${minutes}m before`}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              className="h-5 w-24 rounded border border-border bg-transparent px-1 py-0 text-sm text-foreground"
            />
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="h-5 w-20 rounded border border-border bg-transparent px-1 py-0 text-sm text-foreground"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              disabled={reminderDate.length === 0 || reminderTime.length === 0}
              onClick={commitAddAbsoluteReminder}
            >
              Add
            </Button>
          </div>
        </div>

        <div className="space-y-1.5 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">Sub-tasks</span>
          {children.map((child) => (
            <div key={child.id} className="flex items-center gap-2">
              <button
                type="button"
                aria-label={child.checked === 1 ? 'Uncomplete sub-task' : 'Complete sub-task'}
                onClick={() => toggleChild(child)}
                className={cn(
                  'h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors hover:bg-accent',
                  priorityBorder(child.priority),
                  child.checked === 1 && 'bg-muted-foreground/40'
                )}
              />
              <button
                type="button"
                onClick={() => onSelectTask?.(child.id)}
                className={cn(
                  'flex-1 truncate rounded-sm px-1 py-0.5 text-left text-sm hover:bg-accent',
                  child.checked === 1 ? 'text-muted-foreground line-through' : 'text-foreground'
                )}
              >
                {child.content}
              </button>
            </div>
          ))}
          <Input
            placeholder="Add sub-task…"
            value={newSubtaskContent}
            onChange={(event) => setNewSubtaskContent(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitAddSubtask()
              }
              if (event.key === 'Escape') {
                setNewSubtaskContent('')
              }
            }}
            className="h-7 text-xs"
          />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
        <Button variant="outline" size="sm" onClick={() => onComplete(task.id)}>
          Complete
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(task.id)}>
          Delete
        </Button>
      </div>
    </div>
  )
}

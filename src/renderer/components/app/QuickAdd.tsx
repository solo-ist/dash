import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/utils'
import { parse } from '../../../shared/quickadd'
import type { Span } from '../../../shared/quickadd'
import type { TaskAddInput } from '../../../shared/api'
import type { ProjectRow } from '../../../shared/types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'

export interface QuickAddProps {
  add: (input: TaskAddInput) => Promise<void>
  projects: ProjectRow[]
  defaultProjectId: string | null
}

interface Segment {
  kind: 'text' | Span['kind']
  text: string
  testId?: string
}

const PRIORITY_TEXT: Record<1 | 2 | 3 | 4, string> = {
  1: 'text-red-400',
  2: 'text-orange-400',
  3: 'text-blue-400',
  4: 'text-muted-foreground'
}

function priorityClass(chipText: string): string {
  const match = /p([1-4])/i.exec(chipText)
  const level = match ? (Number(match[1]) as 1 | 2 | 3 | 4) : 4
  return PRIORITY_TEXT[level]
}

function chipClassName(kind: Exclude<Segment['kind'], 'text'>, chipText: string): string {
  switch (kind) {
    case 'priority':
      return cn('rounded-sm bg-muted px-1 font-medium', priorityClass(chipText))
    case 'project':
      return 'rounded-sm bg-secondary px-1 text-secondary-foreground'
    case 'label':
      return 'rounded-sm border border-border px-1 text-muted-foreground'
    case 'duration':
      return 'rounded-sm bg-muted px-1 text-muted-foreground'
    case 'recur':
      return 'rounded-sm bg-muted px-1 text-muted-foreground'
    case 'date':
      return 'rounded-sm bg-muted px-1 font-medium'
  }
}

function buildSegments(raw: string, spans: Span[]): Segment[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start)
  const merged: Array<{ start: number; end: number; kind: Span['kind'] }> = []

  for (const span of sorted) {
    const last = merged[merged.length - 1]
    if (
      last !== undefined &&
      ((last.kind === 'recur' && span.kind === 'date') || (last.kind === 'date' && span.kind === 'recur')) &&
      raw.slice(last.end, span.start).trim() === ''
    ) {
      last.end = span.end
      last.kind = 'date'
      continue
    }
    merged.push({ start: span.start, end: span.end, kind: span.kind })
  }

  const segments: Segment[] = []
  let cursor = 0
  for (const m of merged) {
    if (m.start > cursor) {
      segments.push({ kind: 'text', text: raw.slice(cursor, m.start) })
    }
    segments.push({ kind: m.kind, text: raw.slice(m.start, m.end), testId: `qa-chip-${m.kind}` })
    cursor = m.end
  }
  if (cursor < raw.length) {
    segments.push({ kind: 'text', text: raw.slice(cursor) })
  }
  return segments
}

function resolveProjectId(
  projectRef: string | undefined,
  projects: ProjectRow[],
  defaultProjectId: string | null
): string | undefined {
  if (projectRef !== undefined) {
    const match = projects.find((p) => p.name.toLowerCase() === projectRef.toLowerCase())
    if (match !== undefined) return match.id
  }
  if (defaultProjectId !== null) return defaultProjectId
  return projects.find((p) => p.is_inbox === 1)?.id
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export function QuickAdd({ add, projects, defaultProjectId }: QuickAddProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent): void {
      if (open) return
      if (event.key !== 'q' || event.metaKey || event.ctrlKey || event.altKey) return
      if (isEditableTarget(event.target)) return
      event.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [open])

  const parseResult = useMemo(() => parse(text), [text])
  const segments = useMemo(() => buildSegments(text, parseResult.spans), [text, parseResult.spans])

  function handleOpenChange(next: boolean): void {
    if (next) {
      setOpen(true)
    } else {
      setText('')
      setOpen(false)
    }
  }

  async function handleSubmit(): Promise<void> {
    if (parseResult.content.length === 0) return
    const input: TaskAddInput = {
      content: parseResult.content,
      priority: parseResult.priority,
      dueDate: parseResult.due?.date,
      dueHasTime: parseResult.due?.hasTime,
      recurString: parseResult.recur?.canonical,
      recurStrict: parseResult.recur?.strict,
      durationMin: parseResult.duration,
      projectId: resolveProjectId(parseResult.projectRef, projects, defaultProjectId)
    }
    setText('')
    setOpen(false)
    await add(input)
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Add task
      </Button>
      <DialogContent
        className="gap-3 sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Quick add</DialogTitle>
        </DialogHeader>
        <div className="relative h-10 w-full">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm"
          >
            {segments.map((segment, index) =>
              segment.kind === 'text' ? (
                <span key={index} className="text-foreground">
                  {segment.text}
                </span>
              ) : (
                <span
                  key={index}
                  data-testid={segment.testId}
                  className={chipClassName(segment.kind, segment.text)}
                  style={segment.kind === 'date' ? { color: 'var(--brand-accent)' } : undefined}
                >
                  {segment.text}
                </span>
              )
            )}
          </div>
          <Input
            ref={inputRef}
            data-testid="quick-add-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleInputKeyDown}
            autoComplete="off"
            spellCheck={false}
            placeholder="Add a task — tomorrow p2 #project @label"
            className="absolute inset-0 h-10 w-full border-transparent bg-transparent text-transparent caret-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

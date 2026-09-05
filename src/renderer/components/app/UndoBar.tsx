import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/button'

const AUTO_DISMISS_MS = 5000

export interface UndoNotice {
  message: string
  onUndo: () => void
}

export interface UndoBarProps {
  notice: UndoNotice | null
  onDismiss: () => void
}

export function UndoBar({ notice, onDismiss }: UndoBarProps): React.JSX.Element | null {
  useEffect(() => {
    if (notice === null) return
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [notice, onDismiss])

  if (notice === null) return null

  return (
    <div className="flex items-center gap-3 border-t border-border bg-muted px-4 py-2">
      <span className="flex-1 text-sm text-muted-foreground">{notice.message}</span>
      <Button variant="ghost" size="sm" onClick={notice.onUndo}>
        Undo
      </Button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

import { ScrollArea } from '../ui/scroll-area'
import { TaskRowItem } from './TaskRowItem'
import type { TaskRow } from '../../../shared/types'

export interface TaskListProps {
  tasks: TaskRow[]
  error: string | null
  onComplete: (id: string) => void
  onDelete: (id: string) => void
}

export function TaskList({ tasks, error, onComplete, onDelete }: TaskListProps): React.JSX.Element {
  return (
    <div className="flex h-full flex-col">
      {error !== null && (
        <p className="px-4 py-2 text-xs text-destructive/80">{error}</p>
      )}
      {tasks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No tasks — press q to add</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          {tasks.map((task) => (
            <TaskRowItem key={task.id} task={task} onComplete={onComplete} onDelete={onDelete} />
          ))}
        </ScrollArea>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { TaskRowItem } from './TaskRowItem'
import { TaskList } from './TaskList'
import { todayLocalDate, isOverdue, datePart } from '../../lib/dates'
import type { TaskRow } from '../../../shared/types'
import type { TaskMoveScope } from '../../stores/taskStore'

interface TodayViewProps {
  tasks: TaskRow[]
  onSelectTask: (id: string) => void
  selectedTaskId: string | null
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, targetIndex: number, scope?: TaskMoveScope) => void
}

export function TodayView({
  tasks,
  onSelectTask,
  selectedTaskId,
  onComplete,
  onDelete,
  onMove
}: TodayViewProps): React.JSX.Element {
  const today = todayLocalDate()
  const [overdueTasks, setOverdueTasks] = useState<TaskRow[]>([])
  const [todayTasks, setTodayTasks] = useState<TaskRow[]>([])

  useEffect(() => {
    const overdue: TaskRow[] = []
    const dueToday: TaskRow[] = []
    
    for (const task of tasks) {
      if (isOverdue(task.due_date!, today)) {
        overdue.push(task)
      } else if (datePart(task.due_date!) === today) {
        dueToday.push(task)
      }
    }
    
    setOverdueTasks(overdue.sort((a, b) => a.due_date!.localeCompare(b.due_date!)))
    setTodayTasks(dueToday.sort((a, b) => a.due_date!.localeCompare(b.due_date!)))
  }, [tasks, today])

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {overdueTasks.length > 0 && (
        <div className="px-4 py-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-500">Overdue</h2>
          <div className="space-y-1">
            {overdueTasks.map((task) => (
              <TaskRowItem
                key={task.id}
                task={task}
                selected={selectedTaskId === task.id}
                onSelect={() => onSelectTask(task.id)}
                onComplete={() => onComplete(task.id)}
                onDelete={() => onDelete(task.id)}
                onMove={onMove}
              />
            ))}
          </div>
        </div>
      )}
      
      <div className="px-4 py-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today</h2>
        <TaskList
          tasks={todayTasks}
          error={null}
          selectedTaskId={selectedTaskId}
          onSelect={onSelectTask}
          onComplete={onComplete}
          onDelete={onDelete}
          onMove={onMove}
        />
      </div>
    </div>
  )
}
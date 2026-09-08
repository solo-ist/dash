import { useState, useEffect } from 'react'
import { TaskRowItem } from './TaskRowItem'
import { TaskList } from './TaskList'
import { todayLocalDate, datePart, parseLocalDate, addDaysLocal } from '../../lib/dates'
import type { TaskRow } from '../../../shared/types'
import type { TaskMoveScope } from '../../stores/taskStore'

// Helper functions for day key generation and grouping
export function generateDayKeys(today: string, horizonDays: number): string[] {
  const keys: string[] = []
  const todayDate = parseLocalDate(today)
  
  for (let i = 0; i < horizonDays; i++) {
    const date = new Date(todayDate)
    date.setDate(todayDate.getDate() + i)
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    keys.push(`${year}-${month}-${day}`)
  }
  
  return keys
}

export function groupTasksByDay(tasks: TaskRow[], dayKeys: string[]): Record<string, TaskRow[]> {
  const grouped: Record<string, TaskRow[]> = {}
  
  // Initialize all keys with empty arrays
  for (const key of dayKeys) {
    grouped[key] = []
  }
  
  // Group tasks by their due date (first 10 characters)
  for (const task of tasks) {
    if (task.due_date) {
      const dayKey = task.due_date.slice(0, 10)
      if (grouped[dayKey] !== undefined) {
        grouped[dayKey].push(task)
      }
    }
  }
  
  // Sort tasks within each day
  for (const key in grouped) {
    grouped[key].sort((a, b) => a.due_date!.localeCompare(b.due_date!))
  }
  
  return grouped
}

interface UpcomingViewProps {
  tasks: TaskRow[]
  onSelectTask: (id: string) => void
  selectedTaskId: string | null
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, targetIndex: number, scope?: TaskMoveScope) => void
}

export function UpcomingView({
  tasks,
  onSelectTask,
  selectedTaskId,
  onComplete,
  onDelete,
  onMove
}: UpcomingViewProps): React.JSX.Element {
  const today = todayLocalDate()
  const [overdueTasks, setOverdueTasks] = useState<TaskRow[]>([])
  const [groupedTasks, setGroupedTasks] = useState<Record<string, TaskRow[]>>({})
  const [dayKeys, setDayKeys] = useState<string[]>([])

  useEffect(() => {
    // Generate day keys for the next 7 days (including today)
    const keys = generateDayKeys(today, 7)
    setDayKeys(keys)
    
    // Separate overdue tasks (due date < today)
    const overdue: TaskRow[] = []
    const upcoming: TaskRow[] = []
    
    for (const task of tasks) {
      if (task.due_date) {
        const dueDatePart = task.due_date.slice(0, 10)
        if (dueDatePart < today) {
          overdue.push(task)
        } else {
          upcoming.push(task)
        }
      }
    }
    
    setOverdueTasks(overdue.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')))
    
    // Group the upcoming tasks by day
    const grouped = groupTasksByDay(upcoming, keys)
    setGroupedTasks(grouped)
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
      
      {/* Week strip */}
      <div className="flex justify-between px-4 py-2">
        {dayKeys.map((dayKey, index) => {
          const date = parseLocalDate(dayKey)
          const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
          const dayNumber = date.getDate()
          
          let dayLabel = ''
          if (index === 0) {
            dayLabel = 'Today'
          } else if (index === 1) {
            dayLabel = 'Tomorrow'
          } else {
            dayLabel = `${weekday} ${dayNumber}`
          }
          
          return (
            <div key={dayKey} className="flex flex-col items-center rounded-md px-2 py-1 text-sm">
              <span className="text-xs text-muted-foreground">{weekday}</span>
              <span className="font-medium">{dayNumber}</span>
            </div>
          )
        })}
      </div>
      
      {/* Task sections */}
      {dayKeys.map((dayKey) => {
        const tasksForDay = groupedTasks[dayKey] || []
        if (tasksForDay.length === 0) return null
        
        const date = parseLocalDate(dayKey)
        const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()]
        const dayNumber = date.getDate()
        const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][date.getMonth()]
        
        let dayLabel = ''
        if (dayKey === today) {
          dayLabel = 'Today'
        } else {
          // Calculate tomorrow's date correctly
          const tomorrowStr = addDaysLocal(today, 1)
          
          if (dayKey === tomorrowStr) {
            dayLabel = 'Tomorrow'
          } else {
            dayLabel = `${weekday}, ${month} ${dayNumber}`
          }
        }
        
        return (
          <div key={dayKey} className="px-4 py-3">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {dayLabel}
            </h2>
            <TaskList
              tasks={tasksForDay}
              error={null}
              selectedTaskId={selectedTaskId}
              onSelect={onSelectTask}
              onComplete={onComplete}
              onDelete={onDelete}
              onMove={onMove}
            />
          </div>
        )
      })}
    </div>
  )
}
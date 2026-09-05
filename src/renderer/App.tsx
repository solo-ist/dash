import { useEffect, useState } from 'react'
import { createTaskStore, selectOpenTasks } from './stores/taskStore'
import { createProjectStore, selectInbox, selectFavorites, selectRegularProjects } from './stores/projectStore'
import { Sidebar } from './components/app/Sidebar'
import { TaskList } from './components/app/TaskList'
import { QuickAdd } from './components/app/QuickAdd'
import { UndoBar, type UndoNotice } from './components/app/UndoBar'
import type { TaskAddInput } from '../shared/api'

const useTaskStore = createTaskStore(window.api)
const useProjectStore = createProjectStore(window.api)

export default function App(): React.JSX.Element {
  const tasks = useTaskStore((s) => s.tasks)
  const taskError = useTaskStore((s) => s.error)
  const loadTasks = useTaskStore((s) => s.load)
  const completeTask = useTaskStore((s) => s.complete)
  const uncompleteTask = useTaskStore((s) => s.uncomplete)
  const removeTask = useTaskStore((s) => s.remove)
  const undeleteTask = useTaskStore((s) => s.undelete)
  const addTask = useTaskStore((s) => s.add)

  const [undoNotice, setUndoNotice] = useState<UndoNotice | null>(null)

  const projects = useProjectStore((s) => s.projects)
  const projectsLoaded = useProjectStore((s) => s.loaded)
  const projectError = useProjectStore((s) => s.error)
  const loadProjects = useProjectStore((s) => s.load)

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  useEffect(() => {
    void loadTasks()
    void loadProjects()
  }, [loadTasks, loadProjects])

  const inbox = selectInbox(projects)
  const favorites = selectFavorites(projects)
  const regularProjects = selectRegularProjects(projects)

  useEffect(() => {
    if (selectedProjectId === null && projectsLoaded && inbox !== undefined) {
      setSelectedProjectId(inbox.id)
    }
  }, [selectedProjectId, projectsLoaded, inbox])

  const openTasks = selectedProjectId === null ? [] : selectOpenTasks(tasks, selectedProjectId)
  const error = taskError ?? projectError

  const handleAdd = async (input: TaskAddInput): Promise<void> => {
    await addTask(input)
    // On a fresh DB the first add lazily creates Inbox in the main process;
    // refetch so the sidebar and selection learn it exists.
    void loadProjects()
  }

  const handleComplete = (id: string): void => {
    void completeTask(id)
    setUndoNotice({
      message: 'Task completed',
      onUndo: () => {
        void uncompleteTask(id)
        setUndoNotice(null)
      }
    })
  }

  const handleDelete = (id: string): void => {
    void removeTask(id)
    setUndoNotice({
      message: 'Task deleted',
      onUndo: () => {
        void undeleteTask(id)
        setUndoNotice(null)
      }
    })
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="app-region-drag flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="text-sm text-muted-foreground">
          dash<span style={{ color: 'var(--brand-accent)' }}>—</span>
        </span>
        <div className="app-region-no-drag">
          <QuickAdd add={handleAdd} projects={projects} defaultProjectId={selectedProjectId} />
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          inbox={inbox}
          favorites={favorites}
          projects={regularProjects}
          selectedProjectId={selectedProjectId}
          onSelect={setSelectedProjectId}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <TaskList tasks={openTasks} error={error} onComplete={handleComplete} onDelete={handleDelete} />
          </div>
          <UndoBar notice={undoNotice} onDismiss={() => setUndoNotice(null)} />
        </main>
      </div>
    </div>
  )
}

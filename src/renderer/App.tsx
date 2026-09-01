import { useEffect, useState } from 'react'
import { createTaskStore, selectOpenTasks } from './stores/taskStore'
import { createProjectStore, selectInbox, selectFavorites, selectRegularProjects } from './stores/projectStore'
import { Sidebar } from './components/app/Sidebar'
import { TaskList } from './components/app/TaskList'

const useTaskStore = createTaskStore(window.api)
const useProjectStore = createProjectStore(window.api)

export default function App(): React.JSX.Element {
  const tasks = useTaskStore((s) => s.tasks)
  const taskError = useTaskStore((s) => s.error)
  const loadTasks = useTaskStore((s) => s.load)
  const completeTask = useTaskStore((s) => s.complete)

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

  return (
    <div className="flex h-screen flex-col">
      <header className="app-region-drag flex h-12 shrink-0 items-center justify-center border-b border-border">
        <span className="text-sm text-muted-foreground">
          dash<span style={{ color: 'var(--brand-accent)' }}>—</span>
        </span>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          inbox={inbox}
          favorites={favorites}
          projects={regularProjects}
          selectedProjectId={selectedProjectId}
          onSelect={setSelectedProjectId}
        />
        <main className="flex-1 overflow-hidden">
          <TaskList tasks={openTasks} error={error} onComplete={(id) => void completeTask(id)} />
        </main>
      </div>
    </div>
  )
}

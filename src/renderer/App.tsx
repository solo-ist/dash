import { useEffect, useState } from 'react'
import { createTaskStore, selectOpenTasks } from './stores/taskStore'
import {
  createProjectStore,
  selectInbox,
  selectFavorites,
  selectRegularProjects,
  selectArchivedProjects
} from './stores/projectStore'
import { createSectionStore, selectSectionsForProject } from './stores/sectionStore'
import { createLabelStore, selectLabelsForTask, selectSortedLabels } from './stores/labelStore'
import { Sidebar } from './components/app/Sidebar'
import { TaskList } from './components/app/TaskList'
import { BoardView } from './components/app/BoardView'
import { TaskDetailPanel } from './components/app/TaskDetailPanel'
import { QuickAdd } from './components/app/QuickAdd'
import { UndoBar, type UndoNotice } from './components/app/UndoBar'
import { selectSubtaskCounts } from './stores/boardSelectors'
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs'
import { TodayView } from './components/app/TodayView'
import { UpcomingView } from './components/app/UpcomingView'
import type { TaskAddInput } from '../shared/api

const useTaskStore = createTaskStore(window.api)
const useProjectStore = createProjectStore(window.api)
const useSectionStore = createSectionStore(window.api)
const useLabelStore = createLabelStore(window.api)

export default function App(): React.JSX.Element {
  const tasks = useTaskStore((s) => s.tasks)
  const taskError = useTaskStore((s) => s.error)
  const loadTasks = useTaskStore((s) => s.load)
  const completeTask = useTaskStore((s) => s.complete)
  const uncompleteTask = useTaskStore((s) => s.uncomplete)
  const removeTask = useTaskStore((s) => s.remove)
  const undeleteTask = useTaskStore((s) => s.undelete)
  const addTask = useTaskStore((s) => s.add)
  const updateTask = useTaskStore((s) => s.update)
  const moveTask = useTaskStore((s) => s.moveTask)

  const [undoNotice, setUndoNotice] = useState<UndoNotice | null>(null)

  const projects = useProjectStore((s) => s.projects)
  const projectsLoaded = useProjectStore((s) => s.loaded)
  const projectError = useProjectStore((s) => s.error)
  const loadProjects = useProjectStore((s) => s.load)
  const addProject = useProjectStore((s) => s.add)
  const renameProject = useProjectStore((s) => s.rename)
  const toggleProjectFavorite = useProjectStore((s) => s.toggleFavorite)
  const archiveProject = useProjectStore((s) => s.archive)
  const unarchiveProject = useProjectStore((s) => s.unarchive)
  const removeProject = useProjectStore((s) => s.remove)

  const sections = useSectionStore((s) => s.sections)
  const loadSections = useSectionStore((s) => s.load)
  const addSection = useSectionStore((s) => s.add)
  const renameSection = useSectionStore((s) => s.rename)
  const archiveSection = useSectionStore((s) => s.archive)
  const removeSection = useSectionStore((s) => s.remove)

  const labels = useLabelStore((s) => s.labels)
  const taskLabels = useLabelStore((s) => s.taskLabels)
  const loadLabels = useLabelStore((s) => s.load)
  const addLabel = useLabelStore((s) => s.add)
  const renameLabel = useLabelStore((s) => s.rename)
  const removeLabel = useLabelStore((s) => s.remove)
  const setTaskLabels = useLabelStore((s) => s.setTaskLabels)

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'board' | 'today' | 'upcoming'>('list')

  useEffect(() => {
    void loadTasks()
    void loadProjects()
    void loadSections()
    void loadLabels()
  }, [loadTasks, loadProjects, loadSections, loadLabels])

  const inbox = selectInbox(projects)
  const favorites = selectFavorites(projects)
  const regularProjects = selectRegularProjects(projects)
  const archivedProjects = selectArchivedProjects(projects)

  useEffect(() => {
    if (selectedProjectId === null && projectsLoaded && inbox !== undefined) {
      setSelectedProjectId(inbox.id)
    }
  }, [selectedProjectId, projectsLoaded, inbox])

  // Handle view transitions
  useEffect(() => {
    if (view === 'upcoming') {
      void loadTasks()
    }
  }, [view, loadTasks])

  const openTasks = selectedProjectId === null ? [] : selectOpenTasks(tasks, selectedProjectId)
  const projectSections = selectedProjectId === null ? [] : selectSectionsForProject(sections, selectedProjectId)
  const error = taskError ?? projectError
  const sortedLabels = selectSortedLabels(labels)

  const labelsByTaskId: Record<string, ReturnType<typeof selectLabelsForTask>> = {}
  for (const task of openTasks) {
    labelsByTaskId[task.id] = selectLabelsForTask(labels, taskLabels, task.id)
  }

  const subtaskCounts = selectSubtaskCounts(openTasks)
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null

  useEffect(() => {
    if (selectedTaskId !== null && (selectedTask === null || selectedTask.checked === 1)) {
      setSelectedTaskId(null)
    }
  }, [selectedTaskId, selectedTask])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (selectedTaskId === null) return
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      if (event.key === '1' || event.key === '2' || event.key === '3' || event.key === '4') {
        void updateTask(selectedTaskId, { priority: Number(event.key) as 1 | 2 | 3 | 4 })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedTaskId, updateTask])

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
          archivedProjects={archivedProjects}
          selectedProjectId={selectedProjectId}
          onSelect={setSelectedProjectId}
          onAddProject={(input) => void addProject(input)}
          onRenameProject={(id, name) => void renameProject(id, name)}
          onToggleFavorite={(id) => void toggleProjectFavorite(id)}
          onArchiveProject={(id) => void archiveProject(id)}
          onUnarchiveProject={(id) => void unarchiveProject(id)}
          onDeleteProject={(id) => void removeProject(id)}
          labels={sortedLabels}
          onAddLabel={(input) => void addLabel(input)}
          onRenameLabel={(id, name) => void renameLabel(id, name)}
          onDeleteLabel={(id) => void removeLabel(id)}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-end border-b border-border px-4 py-1.5">
            <Tabs value={view} onValueChange={(value) => setView(value as 'list' | 'board' | 'today' | 'upcoming')}>
              <TabsList>
                <TabsTrigger value="list">List</TabsTrigger>
                <TabsTrigger value="board">Board</TabsTrigger>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-hidden">
              {view === 'list' ? (
                <TaskList
                  tasks={openTasks}
                  sections={projectSections}
                  error={error}
                  selectedTaskId={selectedTaskId}
                  labelsByTaskId={labelsByTaskId}
                  onComplete={handleComplete}
                  onDelete={handleDelete}
                  onSelect={(id) => setSelectedTaskId((current) => (current === id ? null : id))}
                  onMove={(id, targetIndex, scope) => void moveTask(id, targetIndex, scope)}
                  onAddSection={(name) => {
                    if (selectedProjectId !== null) void addSection({ projectId: selectedProjectId, name })
                  }}
                  onRenameSection={(id, name) => void renameSection(id, name)}
                  onArchiveSection={(id) => void archiveSection(id)}
                  onDeleteSection={(id) => void removeSection(id)}
                />
              ) : view === 'today' ? (
                <TodayView
                  tasks={openTasks}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={(id) => setSelectedTaskId((current) => (current === id ? null : id))}
                  onComplete={handleComplete}
                  onDelete={handleDelete}
                  onMove={(id, targetIndex, scope) => void moveTask(id, targetIndex, scope)}
                />
              ) : view === 'upcoming' ? (
                <UpcomingView
                  tasks={openTasks}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={(id) => setSelectedTaskId((current) => (current === id ? null : id))}
                  onComplete={handleComplete}
                  onDelete={handleDelete}
                  onMove={(id, targetIndex, scope) => void moveTask(id, targetIndex, scope)}
                />
              ) : (
                selectedProjectId !== null && (
                  <BoardView
                    tasks={openTasks}
                    sections={projectSections}
                    projectId={selectedProjectId}
                    selectedTaskId={selectedTaskId}
                    subtaskCounts={subtaskCounts}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                    onSelect={(id) => setSelectedTaskId((current) => (current === id ? null : id))}
                    onMove={(id, targetIndex, scope) => void moveTask(id, targetIndex, scope)}
                  />
                )
              )}
            </div>
            {selectedTask !== null && (
              <TaskDetailPanel
                task={selectedTask}
                projectName={projects.find((project) => project.id === selectedTask.project_id)?.name ?? ''}
                sectionName={sections.find((section) => section.id === selectedTask.section_id)?.name ?? null}
                onUpdate={(patch) => void updateTask(selectedTask.id, patch)}
                onClose={() => setSelectedTaskId(null)}
                onComplete={handleComplete}
                onDelete={handleDelete}
                allLabels={sortedLabels}
                assignedLabels={selectLabelsForTask(labels, taskLabels, selectedTask.id)}
                onSetLabels={(taskId, labelIds) => void setTaskLabels(taskId, labelIds)}
              />
            )}
          </div>
          <UndoBar notice={undoNotice} onDismiss={() => setUndoNotice(null)} />
        </main>
      </div>
    </div>
  )
}

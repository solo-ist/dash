import { useState } from 'react'
import { cn } from '../../lib/utils'
import { ScrollArea } from '../ui/scroll-area'
import { Separator } from '../ui/separator'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '../ui/context-menu'
import type { ProjectRow } from '../../../shared/types'

export interface SidebarProps {
  inbox: ProjectRow | undefined
  favorites: ProjectRow[]
  projects: ProjectRow[]
  archivedProjects: ProjectRow[]
  selectedProjectId: string | null
  onSelect: (projectId: string) => void
  onAddProject: (input: { name: string; color?: string }) => void
  onRenameProject: (id: string, name: string) => void
  onToggleFavorite: (id: string) => void
  onArchiveProject: (id: string) => void
  onUnarchiveProject: (id: string) => void
  onDeleteProject: (id: string) => void
}

interface ProjectDialogState {
  mode: 'add' | 'rename'
  projectId?: string
  name: string
  color: string
}

function SidebarRow({
  project,
  selected,
  onSelect,
  onRename,
  onToggleFavorite,
  onArchive,
  onUnarchive,
  onDelete
}: {
  project: ProjectRow
  selected: boolean
  onSelect: (projectId: string) => void
  onRename: (project: ProjectRow) => void
  onToggleFavorite?: (id: string) => void
  onArchive?: (id: string) => void
  onUnarchive?: (id: string) => void
  onDelete: (id: string) => void
}): React.JSX.Element {
  const archived = project.archived_at !== null

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={() => onSelect(project.id)}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
            selected
              ? 'bg-accent text-accent-foreground'
              : 'text-foreground hover:bg-accent/50 hover:text-accent-foreground'
          )}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
          <span className="truncate">{project.name}</span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {onToggleFavorite !== undefined && (
          <ContextMenuItem onSelect={() => onToggleFavorite(project.id)}>
            {project.is_favorite === 1 ? 'Remove from favorites' : 'Add to favorites'}
          </ContextMenuItem>
        )}
        <ContextMenuItem onSelect={() => onRename(project)}>Rename</ContextMenuItem>
        {!archived && onArchive !== undefined && (
          <ContextMenuItem onSelect={() => onArchive(project.id)}>Archive</ContextMenuItem>
        )}
        {archived && onUnarchive !== undefined && (
          <ContextMenuItem onSelect={() => onUnarchive(project.id)}>Unarchive</ContextMenuItem>
        )}
        <ContextMenuItem className="text-destructive" onSelect={() => onDelete(project.id)}>
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function Sidebar({
  inbox,
  favorites,
  projects,
  archivedProjects,
  selectedProjectId,
  onSelect,
  onAddProject,
  onRenameProject,
  onToggleFavorite,
  onArchiveProject,
  onUnarchiveProject,
  onDeleteProject
}: SidebarProps): React.JSX.Element {
  const [dialog, setDialog] = useState<ProjectDialogState | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  function openAddDialog(): void {
    setDialog({ mode: 'add', name: '', color: '' })
  }

  function openRenameDialog(project: ProjectRow): void {
    setDialog({ mode: 'rename', projectId: project.id, name: project.name, color: project.color })
  }

  function handleDialogSubmit(): void {
    if (dialog === null || dialog.name.trim().length === 0) return
    if (dialog.mode === 'add') {
      onAddProject({ name: dialog.name.trim(), color: dialog.color.trim() || undefined })
    } else if (dialog.projectId !== undefined) {
      onRenameProject(dialog.projectId, dialog.name.trim())
    }
    setDialog(null)
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border">
      <ScrollArea className="flex-1 px-2 py-3">
        <div className="flex flex-col gap-1">
          {inbox !== undefined && (
            <SidebarRow
              project={inbox}
              selected={selectedProjectId === inbox.id}
              onSelect={onSelect}
              onRename={openRenameDialog}
              onDelete={onDeleteProject}
            />
          )}
        </div>

        {favorites.length > 0 && (
          <>
            <Separator className="my-3" />
            <p className="px-2 pb-1 text-xs font-medium uppercase text-muted-foreground">
              Favorites
            </p>
            <div className="flex flex-col gap-1">
              {favorites.map((project) => (
                <SidebarRow
                  key={project.id}
                  project={project}
                  selected={selectedProjectId === project.id}
                  onSelect={onSelect}
                  onRename={openRenameDialog}
                  onToggleFavorite={onToggleFavorite}
                  onArchive={onArchiveProject}
                  onDelete={onDeleteProject}
                />
              ))}
            </div>
          </>
        )}

        <Separator className="my-3" />
        <div className="flex items-center justify-between px-2 pb-1">
          <p className="text-xs font-medium uppercase text-muted-foreground">Projects</p>
          <button
            type="button"
            onClick={openAddDialog}
            className="text-xs text-muted-foreground hover:text-foreground"
            aria-label="Add project"
          >
            +
          </button>
        </div>
        <div className="flex flex-col gap-1">
          {projects.map((project) => (
            <SidebarRow
              key={project.id}
              project={project}
              selected={selectedProjectId === project.id}
              onSelect={onSelect}
              onRename={openRenameDialog}
              onToggleFavorite={onToggleFavorite}
              onArchive={onArchiveProject}
              onDelete={onDeleteProject}
            />
          ))}
        </div>

        {archivedProjects.length > 0 && (
          <>
            <Separator className="my-3" />
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="w-full px-2 pb-1 text-left text-xs font-medium uppercase text-muted-foreground hover:text-foreground"
            >
              Archived ({archivedProjects.length}) {showArchived ? '▾' : '▸'}
            </button>
            {showArchived && (
              <div className="flex flex-col gap-1">
                {archivedProjects.map((project) => (
                  <SidebarRow
                    key={project.id}
                    project={project}
                    selected={selectedProjectId === project.id}
                    onSelect={onSelect}
                    onRename={openRenameDialog}
                    onUnarchive={onUnarchiveProject}
                    onDelete={onDeleteProject}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </ScrollArea>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'add' ? 'New project' : 'Rename project'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              autoFocus
              placeholder="Project name"
              value={dialog?.name ?? ''}
              onChange={(event) =>
                setDialog((prev) => (prev !== null ? { ...prev, name: event.target.value } : prev))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleDialogSubmit()
                }
              }}
            />
            {dialog?.mode === 'add' && (
              <Input
                placeholder="Color (optional)"
                value={dialog?.color ?? ''}
                onChange={(event) =>
                  setDialog((prev) => (prev !== null ? { ...prev, color: event.target.value } : prev))
                }
              />
            )}
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleDialogSubmit}>
              {dialog?.mode === 'add' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}

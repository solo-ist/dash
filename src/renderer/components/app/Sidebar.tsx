import { cn } from '../../lib/utils'
import { ScrollArea } from '../ui/scroll-area'
import { Separator } from '../ui/separator'
import type { ProjectRow } from '../../../shared/types'

export interface SidebarProps {
  inbox: ProjectRow | undefined
  favorites: ProjectRow[]
  projects: ProjectRow[]
  selectedProjectId: string | null
  onSelect: (projectId: string) => void
}

function SidebarRow({
  project,
  selected,
  onSelect
}: {
  project: ProjectRow
  selected: boolean
  onSelect: (projectId: string) => void
}): React.JSX.Element {
  return (
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
  )
}

export function Sidebar({
  inbox,
  favorites,
  projects,
  selectedProjectId,
  onSelect
}: SidebarProps): React.JSX.Element {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border">
      <ScrollArea className="flex-1 px-2 py-3">
        <div className="flex flex-col gap-1">
          {inbox !== undefined && (
            <SidebarRow
              project={inbox}
              selected={selectedProjectId === inbox.id}
              onSelect={onSelect}
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
                />
              ))}
            </div>
          </>
        )}

        {projects.length > 0 && (
          <>
            <Separator className="my-3" />
            <p className="px-2 pb-1 text-xs font-medium uppercase text-muted-foreground">
              Projects
            </p>
            <div className="flex flex-col gap-1">
              {projects.map((project) => (
                <SidebarRow
                  key={project.id}
                  project={project}
                  selected={selectedProjectId === project.id}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </>
        )}
      </ScrollArea>
    </aside>
  )
}

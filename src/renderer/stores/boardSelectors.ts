import type { SectionRow, TaskRow } from '../../shared/types'

export interface BoardColumn {
  sectionId: string | null
  tasks: TaskRow[]
}

// Mirrors taskStore's compareTaskOrder / the main process's
// `ORDER BY task_order, added_at, id` — kept as a local copy since taskStore
// does not export it.
export function compareTaskOrder(a: TaskRow, b: TaskRow): number {
  if (a.task_order !== b.task_order) return a.task_order - b.task_order
  const addedDiff = new Date(a.added_at).getTime() - new Date(b.added_at).getTime()
  if (addedDiff !== 0) return addedDiff
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

// Boards render one column per non-archived section of the project, plus a
// leading "No section" column, each holding the project's top-level open
// tasks assigned to that section.
export function selectBoardColumns(tasks: TaskRow[], sections: SectionRow[], projectId: string): BoardColumn[] {
  const projectSections = sections
    .filter((section) => section.project_id === projectId && section.deleted_at === null && section.archived_at === null)
    .sort((a, b) => a.section_order - b.section_order)

  const columnSectionIds: Array<string | null> = [null, ...projectSections.map((section) => section.id)]

  return columnSectionIds.map((sectionId) => ({
    sectionId,
    tasks: tasks
      .filter(
        (task) =>
          task.project_id === projectId &&
          task.section_id === sectionId &&
          task.parent_id === null &&
          task.checked === 0 &&
          task.deleted_at === null
      )
      .sort(compareTaskOrder)
  }))
}

// Counts open (non-deleted, unchecked) direct children per parent id.
export function selectSubtaskCounts(tasks: TaskRow[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const task of tasks) {
    if (task.parent_id === null || task.deleted_at !== null || task.checked !== 0) continue
    counts[task.parent_id] = (counts[task.parent_id] ?? 0) + 1
  }
  return counts
}

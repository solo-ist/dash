export interface TaskRow {
  id: string
  content: string
  description: string
  project_id: string
  section_id: string | null
  parent_id: string | null
  priority: number
  due_date: string | null
  due_has_time: number
  recur_string: string | null
  recur_strict: number
  recur_ends: string | null
  deadline_date: string | null
  duration_min: number | null
  task_order: number
  is_header: number
  checked: number
  completed_at: string | null
  added_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ProjectRow {
  id: string
  name: string
  description: string
  color: string
  parent_id: string | null
  is_inbox: number
  is_favorite: number
  view_style: string
  child_order: number
  archived_at: string | null
  updated_at: string
  deleted_at: string | null
}

export interface SectionRow {
  id: string
  project_id: string
  name: string
  section_order: number
  archived_at: string | null
  updated_at: string
  deleted_at: string | null
}

export interface LabelRow {
  id: string
  name: string
  color: string
  label_order: number
  is_favorite: number
  updated_at: string
  deleted_at: string | null
}

export interface TaskLabelRow {
  task_id: string
  label_id: string
  updated_at: string
  deleted_at: string | null
}

export interface MutateResult {
  tasks?: TaskRow[]
  projects?: ProjectRow[]
  sections?: SectionRow[]
  labels?: LabelRow[]
  taskLabels?: TaskLabelRow[]
}

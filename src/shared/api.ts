import type { ProjectRow, TaskRow } from './types'

export interface TaskAddInput {
  content: string
  description?: string
  projectId?: string
  sectionId?: string
  priority?: 1 | 2 | 3 | 4
  dueDate?: string
  dueHasTime?: boolean
  recurString?: string
  recurStrict?: boolean
  durationMin?: number
}

export interface DashApi {
  platform: string
  tasks: {
    list: (projectId?: string) => Promise<TaskRow[]>
    add: (input: TaskAddInput) => Promise<TaskRow>
    complete: (id: string) => Promise<TaskRow>
    uncomplete: (id: string) => Promise<TaskRow>
    delete: (id: string) => Promise<TaskRow>
    undelete: (id: string) => Promise<TaskRow>
  }
  projects: {
    list: () => Promise<ProjectRow[]>
  }
}

declare global {
  interface Window {
    api: DashApi
  }
}

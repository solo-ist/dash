import type { Op } from './ops'
import type { MutateResult } from './types'
import type { QueryName, QueryParams, QueryResult } from './queries'

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

export interface DataChangedPayload {
  entities: string[]
}

export interface DashApi {
  platform: string
  query: <N extends QueryName>(name: N, params: QueryParams<N>) => Promise<QueryResult<N>>
  mutate: (op: Op) => Promise<MutateResult>
  on: (channel: 'data:changed', cb: (payload: DataChangedPayload) => void) => () => void
}

declare global {
  interface Window {
    api: DashApi
  }
}

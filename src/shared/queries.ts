import { z } from 'zod'
import type { ProjectRow, SectionRow, TaskRow } from './types'

export const QueryParamsSchemas = {
  'tasks.list': z.object({ projectId: z.string().optional() }),
  'projects.list': z.object({}),
  'sections.list': z.object({ projectId: z.string().optional() })
} as const

export interface QueryResultTypes {
  'tasks.list': TaskRow[]
  'projects.list': ProjectRow[]
  'sections.list': SectionRow[]
}

export type QueryName = keyof typeof QueryParamsSchemas

export type QueryParams<N extends QueryName> = z.infer<(typeof QueryParamsSchemas)[N]>

export type QueryResult<N extends QueryName> = QueryResultTypes[N]

export type QueryMap = {
  [N in QueryName]: { params: QueryParams<N>; result: QueryResult<N> }
}

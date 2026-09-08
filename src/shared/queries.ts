import { z } from 'zod'
import type { LabelRow, ProjectRow, SectionRow, TaskLabelRow, TaskRow } from './types'

export const QueryParamsSchemas = {
  'tasks.list': z.object({ projectId: z.string().optional() }),
  'projects.list': z.object({}),
  'sections.list': z.object({ projectId: z.string().optional() }),
  'labels.list': z.object({}),
  'taskLabels.list': z.object({}),
  'tasks.today': z.object({ today: z.string() })
} as const

export interface QueryResultTypes {
  'tasks.list': TaskRow[]
  'projects.list': ProjectRow[]
  'sections.list': SectionRow[]
  'labels.list': LabelRow[]
  'taskLabels.list': TaskLabelRow[]
  'tasks.today': TaskRow[]
}

export type QueryName = keyof typeof QueryParamsSchemas

export type QueryParams<N extends QueryName> = z.infer<(typeof QueryParamsSchemas)[N]>

export type QueryResult<N extends QueryName> = QueryResultTypes[N]

export type QueryMap = {
  [N in QueryName]: { params: QueryParams<N>; result: QueryResult<N> }
}
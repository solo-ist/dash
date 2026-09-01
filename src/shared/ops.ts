import { z } from 'zod'

const priority = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])

const taskOptionalFields = {
  description: z.string().optional(),
  projectId: z.string().optional(),
  sectionId: z.string().optional(),
  priority: priority.optional(),
  dueDate: z.string().optional(),
  dueHasTime: z.boolean().optional(),
  recurString: z.string().optional(),
  recurStrict: z.boolean().optional(),
  durationMin: z.number().int().positive().optional()
}

const TaskAddSchema = z.object({
  type: z.literal('task.add'),
  content: z.string().min(1),
  ...taskOptionalFields
})

const TaskUpdateSchema = z.object({
  type: z.literal('task.update'),
  id: z.string(),
  content: z.string().min(1).optional(),
  ...taskOptionalFields
})

const TaskCompleteSchema = z.object({
  type: z.literal('task.complete'),
  id: z.string()
})

const TaskDeleteSchema = z.object({
  type: z.literal('task.delete'),
  id: z.string()
})

const ProjectAddSchema = z.object({
  type: z.literal('project.add'),
  name: z.string().min(1),
  color: z.string().optional(),
  isFavorite: z.boolean().optional()
})

const ProjectUpdateSchema = z.object({
  type: z.literal('project.update'),
  id: z.string(),
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  isFavorite: z.boolean().optional()
})

const ProjectDeleteSchema = z.object({
  type: z.literal('project.delete'),
  id: z.string()
})

export const OpSchema = z.discriminatedUnion('type', [
  TaskAddSchema,
  TaskUpdateSchema,
  TaskCompleteSchema,
  TaskDeleteSchema,
  ProjectAddSchema,
  ProjectUpdateSchema,
  ProjectDeleteSchema
])

export type Op = z.infer<typeof OpSchema>

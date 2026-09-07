import { z } from 'zod'

const priority = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])

const taskOptionalFields = {
  description: z.string().optional(),
  projectId: z.string().optional(),
  parentId: z.string().nullable().optional(),
  sectionId: z.string().nullable().optional(),
  priority: priority.optional(),
  dueDate: z.string().nullable().optional(),
  dueHasTime: z.boolean().optional(),
  recurString: z.string().nullable().optional(),
  recurStrict: z.boolean().optional(),
  durationMin: z.number().int().positive().nullable().optional()
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

const TaskUncompleteSchema = z.object({
  type: z.literal('task.uncomplete'),
  id: z.string()
})

const TaskUndeleteSchema = z.object({
  type: z.literal('task.undelete'),
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

const ProjectArchiveSchema = z.object({
  type: z.literal('project.archive'),
  id: z.string()
})

const ProjectUnarchiveSchema = z.object({
  type: z.literal('project.unarchive'),
  id: z.string()
})

const SectionAddSchema = z.object({
  type: z.literal('section.add'),
  projectId: z.string(),
  name: z.string().min(1)
})

const SectionUpdateSchema = z.object({
  type: z.literal('section.update'),
  id: z.string(),
  name: z.string().min(1).optional()
})

const SectionDeleteSchema = z.object({
  type: z.literal('section.delete'),
  id: z.string()
})

const SectionArchiveSchema = z.object({
  type: z.literal('section.archive'),
  id: z.string()
})

const SectionUnarchiveSchema = z.object({
  type: z.literal('section.unarchive'),
  id: z.string()
})

export const OpSchema = z.discriminatedUnion('type', [
  TaskAddSchema,
  TaskUpdateSchema,
  TaskCompleteSchema,
  TaskDeleteSchema,
  TaskUncompleteSchema,
  TaskUndeleteSchema,
  ProjectAddSchema,
  ProjectUpdateSchema,
  ProjectDeleteSchema,
  ProjectArchiveSchema,
  ProjectUnarchiveSchema,
  SectionAddSchema,
  SectionUpdateSchema,
  SectionDeleteSchema,
  SectionArchiveSchema,
  SectionUnarchiveSchema
])

export type Op = z.infer<typeof OpSchema>

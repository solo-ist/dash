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
  deadlineDate: z.string().nullable().optional(),
  durationMin: z.number().int().positive().nullable().optional()
}

const TaskAddSchema = z.object({
  type: z.literal('task.add'),
  content: z.string().min(1),
  labels: z.array(z.string()).optional(),
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

const LabelAddSchema = z.object({
  type: z.literal('label.add'),
  name: z.string().min(1),
  color: z.string().optional(),
  isFavorite: z.boolean().optional()
})

const LabelUpdateSchema = z.object({
  type: z.literal('label.update'),
  id: z.string(),
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  isFavorite: z.boolean().optional()
})

const LabelDeleteSchema = z.object({
  type: z.literal('label.delete'),
  id: z.string()
})

const TaskSetLabelsSchema = z.object({
  type: z.literal('task.setLabels'),
  id: z.string(),
  labelIds: z.array(z.string())
})

const TaskMoveSchema = z.object({
  type: z.literal('task.move'),
  id: z.string(),
  targetIndex: z.number().int().min(0),
  projectId: z.string().optional(),
  sectionId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional()
})

const ReminderKindSchema = z.union([z.literal('relative'), z.literal('absolute')])

// Absolute reminders store a local wall-time datetime (never UTC) — see
// src/main/reminders/next-fire.ts for the epoch conversion.
const reminderAt = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)

// Cross-field requirement (relative needs minuteOffset, absolute needs at) is
// enforced in src/main/mutate.ts's addReminder, matching this codebase's
// pattern of invariant checks living in the handler rather than in zod.
const ReminderCreateSchema = z.object({
  type: z.literal('reminder.create'),
  taskId: z.string(),
  kind: ReminderKindSchema,
  minuteOffset: z.number().int().min(0).optional(),
  at: reminderAt.optional()
})

const ReminderUpdateSchema = z.object({
  type: z.literal('reminder.update'),
  id: z.string(),
  kind: ReminderKindSchema.optional(),
  minuteOffset: z.number().int().min(0).nullable().optional(),
  at: reminderAt.nullable().optional()
})

const ReminderDeleteSchema = z.object({
  type: z.literal('reminder.delete'),
  id: z.string()
})

export const OpSchema = z.discriminatedUnion('type', [
  TaskAddSchema,
  TaskUpdateSchema,
  TaskCompleteSchema,
  TaskDeleteSchema,
  TaskUncompleteSchema,
  TaskUndeleteSchema,
  TaskSetLabelsSchema,
  TaskMoveSchema,
  ProjectAddSchema,
  ProjectUpdateSchema,
  ProjectDeleteSchema,
  ProjectArchiveSchema,
  ProjectUnarchiveSchema,
  SectionAddSchema,
  SectionUpdateSchema,
  SectionDeleteSchema,
  SectionArchiveSchema,
  SectionUnarchiveSchema,
  LabelAddSchema,
  LabelUpdateSchema,
  LabelDeleteSchema,
  ReminderCreateSchema,
  ReminderUpdateSchema,
  ReminderDeleteSchema
])

export type Op = z.infer<typeof OpSchema>

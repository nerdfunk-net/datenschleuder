import { z } from 'zod'

// Base schema with common fields
const baseTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().optional(),
  is_global: z.boolean(),
})

// Check Queues job type schema
const checkQueuesTemplateSchema = baseTemplateSchema.extend({
  job_type: z.literal("check_queues"),
  // null = all instances; array of IDs = specific instances
  nifi_instance_ids: z.array(z.number()).nullable().optional(),
})

// Discriminated union for all job types
export const jobTemplateSchema = z.discriminatedUnion("job_type", [
  checkQueuesTemplateSchema,
])

export type JobTemplateFormData = z.infer<typeof jobTemplateSchema>

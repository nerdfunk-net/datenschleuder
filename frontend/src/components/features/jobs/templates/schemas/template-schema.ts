import { z } from 'zod'

// Base schema with common fields
const baseTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().optional(),
  is_global: z.boolean(),
})

// Example job type schema (simplified)
const exampleTemplateSchema = baseTemplateSchema.extend({
  job_type: z.literal("example"),
})

// Discriminated union for all job types
export const jobTemplateSchema = z.discriminatedUnion("job_type", [
  exampleTemplateSchema,
])

export type JobTemplateFormData = z.infer<typeof jobTemplateSchema>

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
  // null = all clusters; array of IDs = specific clusters
  nifi_cluster_ids: z.array(z.number()).nullable().optional(),
})

// Check ProcessGroup job type schema
const checkProgressGroupTemplateSchema = baseTemplateSchema.extend({
  job_type: z.literal("check_progress_group"),
  /** NiFi cluster to target – null means not yet selected */
  check_progress_group_nifi_cluster_id: z.number().nullable().optional(),
  /** UUID of the selected process group */
  check_progress_group_process_group_id: z.string().nullable().optional(),
  /** Human-readable path (stored for display) */
  check_progress_group_process_group_path: z.string().nullable().optional(),
  /** When true, also check all child process groups */
  check_progress_group_check_children: z.boolean().optional(),
  /** Expected operational status of the process group */
  check_progress_group_expected_status: z
    .enum(['Running', 'Stopped', 'Enabled', 'Disabled'])
    .optional(),
})

// Discriminated union for all job types
export const jobTemplateSchema = z.discriminatedUnion("job_type", [
  checkQueuesTemplateSchema,
  checkProgressGroupTemplateSchema,
])

export type JobTemplateFormData = z.infer<typeof jobTemplateSchema>

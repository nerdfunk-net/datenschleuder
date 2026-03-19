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

// Export Flows job type schema
const exportFlowsTemplateSchema = baseTemplateSchema.extend({
  job_type: z.literal("export_flows"),
  /** null = all clusters; array of IDs = specific clusters (informational) */
  export_flows_nifi_cluster_ids: z.array(z.number()).nullable().optional(),
  /** When true, export every flow without filtering */
  export_flows_all_flows: z.boolean().optional(),
  /** Hierarchy filter conditions keyed by attribute name */
  export_flows_filters: z.record(z.string(), z.object({
    source: z.array(z.string()),
    destination: z.array(z.string()),
  })).nullable().optional(),
  /** ID of the git repository to write the exported file into */
  export_flows_git_repo_id: z.number().nullable().optional(),
  /** Output filename (extension added automatically) */
  export_flows_filename: z.string().max(255).nullable().optional(),
  /** Export format: 'json' or 'csv' */
  export_flows_export_type: z.enum(['json', 'csv']).optional(),
  /** When true, commit and push the exported file to git */
  export_flows_push_to_git: z.boolean().optional(),
})

// Discriminated union for all job types
export const jobTemplateSchema = z.discriminatedUnion("job_type", [
  checkQueuesTemplateSchema,
  checkProgressGroupTemplateSchema,
  exportFlowsTemplateSchema,
])

export type JobTemplateFormData = z.infer<typeof jobTemplateSchema>

export interface MissingColumn {
  table: string
  column: string
  type: string
  nullable: boolean
  default: string | null
}

export interface MigrationSystemInfo {
  active: boolean
  applied_migrations_count: number
  last_migration: {
    name: string
    applied_at: string
    description: string
    execution_time_ms: number
  } | null
}

export interface SchemaStatus {
  is_up_to_date: boolean
  missing_tables: string[]
  missing_columns: MissingColumn[]
  migration_system: MigrationSystemInfo
  warnings: string[]
}

export interface AppliedMigration {
  name: string
  applied_at: string
  description: string
  execution_time_ms: number
}

export interface MigrationResponse {
  success: boolean
  message: string
  changes: string[]
  errors: string[]
  warnings?: string[]
}

export interface SeedRbacResponse {
  success: boolean
  message: string
  output: string
}

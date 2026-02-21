export interface BoundProcessGroup {
  id: string
  component?: { name: string }
}

export interface ParameterEntity {
  name: string
  description?: string
  sensitive: boolean
  value?: string
  provided?: boolean
  parameter_context_id?: string
}

export interface ParameterContext {
  id: string
  name: string
  description?: string
  parameters: ParameterEntity[]
  bound_process_groups?: BoundProcessGroup[]
  inherited_parameter_contexts?: string[]
}

export interface ParameterContextListResponse {
  status: string
  parameter_contexts: ParameterContext[]
  count: number
  message?: string
}

export interface ParameterContextDetailResponse {
  status: string
  parameter_context: ParameterContext
}

/** Parameter as used inside the create/edit form, with inheritance metadata. */
export interface FormParameter extends ParameterEntity {
  _key: string
  isExisting: boolean
  isLocal: boolean
  inheritedFrom: string | null
  isOverridden: boolean
}

export interface ParameterContextForm {
  instance_id: number | null
  context_id: string | null
  name: string
  description: string
  parameters: FormParameter[]
  inherited_parameter_contexts: string[]
}

export type ModalMode = 'create' | 'edit'

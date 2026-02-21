export interface PathStatus {
  path: string
  exists: boolean
}

export interface CheckPathResponse {
  status: PathStatus[]
}

export interface ParameterContext {
  id: string
  name: string
}

export interface ParameterContextsResponse {
  status: string
  parameter_contexts: ParameterContext[]
  count: number
}

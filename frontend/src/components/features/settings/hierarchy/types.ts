export interface HierarchyAttribute {
  name: string
  label: string
  order: number
}

export interface HierarchyConfig {
  hierarchy: HierarchyAttribute[]
}

// Local editing state extends the backend type with validation and a stable React key
export interface HierarchyAttributeEditing extends HierarchyAttribute {
  nameError?: string
  _key: string
}

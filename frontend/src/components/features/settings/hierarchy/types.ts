export interface HierarchyAttribute {
  name: string
  label: string
  order: number
}

export interface HierarchyConfig {
  hierarchy: HierarchyAttribute[]
}

// Local editing state extends the backend type with a validation field
export interface HierarchyAttributeEditing extends HierarchyAttribute {
  nameError?: string
}

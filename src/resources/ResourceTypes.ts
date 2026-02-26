import { Color } from 'excalibur'

export type ResourceId = 'iron' | 'crystal' | 'gas'

export interface ResourceTypeDef {
  id: ResourceId
  name: string
  size: number
  value: number
  color: Color
}

export const RESOURCE_TYPES: ResourceTypeDef[] = [
  {
    id: 'iron',
    name: 'Iron',
    size: 1,
    value: 1,
    color: Color.fromHex('#9ca3af'),
  },
  {
    id: 'crystal',
    name: 'Crystal',
    size: 2,
    value: 3,
    color: Color.fromHex('#a855f7'),
  },
  {
    id: 'gas',
    name: 'Gas',
    size: 3,
    value: 4,
    color: Color.fromHex('#22c55e'),
  },
]

export function getResourceById(id: ResourceId): ResourceTypeDef {
  const found = RESOURCE_TYPES.find((r) => r.id === id)
  if (!found) {
    throw new Error(`Unknown resource id: ${id}`)
  }
  return found
}


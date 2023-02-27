import { FIELD_CLASSES } from '../constants'
import { Mappings, MappingType } from '../interfaces'

export const validateMappings = (
  nestedMappings: any
): Mappings => {
  if (typeof nestedMappings !== 'object') {
    throw new Error('Mappings must be an object!')
  }

  let mappings: Mappings = {}

  const flatten = (
    obj: { [key: string]: any },
    currentPath: string[] = []
  ): void => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        const path = [...currentPath, key].join('.')

        if (!FIELD_CLASSES[value]) {
          throw new Error(`Invalid mapping type '${value}' for field '${path}'.`)
        }

        mappings[path] = value as MappingType
        continue
      }

      if (Array.isArray(value)) {
        throw new Error('Mappings must not contain arrays!')
      }

      if (typeof value === 'object') {
        flatten(value, [...currentPath, key])
        continue
      }

      const path = [...currentPath, key].join('.')
      throw new Error(`Invalid value of type '${typeof value}' found at '${path}'.`)
    }
  }

  flatten(nestedMappings)

  return mappings
}

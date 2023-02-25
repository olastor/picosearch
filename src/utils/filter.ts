import { 
  SearchIndex,
  NumberFieldIndex,
  KeywordFieldIndex
} from '../interfaces'
import { binarySearch } from './binary-search'
import * as _ from './helper'
import { FIELD_CLASSES } from '../constants'

export const evaluateFilter = (
  index: SearchIndex,
  filter: any,
  operator = '$and'
): number[] => {
  let operands: number[][] = []
  if (Array.isArray(filter)) {
    operands = filter.map(f => evaluateFilter(index, f)) 
  } else if (typeof filter === 'object') {
    for (const [key, value] of Object.entries(filter)) {
      const fieldMappingType: string = index.mappings[key]

      if (fieldMappingType) {
        operands.push(FIELD_CLASSES[fieldMappingType].filterDocuments(index.fields[key], value))
        continue
      }

      if (['$and', '$or', '$not'].includes(key)) {
        operands.push(evaluateFilter(index, value, key))
        continue
      }

      throw new Error(`The field '${fieldMappingType}' does not exist in index and cannot be used for filtering.`)
    }
  } else {
    throw new Error(`The filter has an invalid type '${typeof filter}'.`)
  }

  if (operator === '$and') {
    return _.intersection(operands) 
  }

  if (operator === '$or') {
    return _.union(operands)
  }

  if (operator === '$not') {
    const union = _.union(operands)
    return Object.values(index.internalIds)
      .filter(id => !union.includes(id))
  }

  throw new Error('')
}


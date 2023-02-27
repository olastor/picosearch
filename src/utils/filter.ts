import { Index } from '../interfaces'
import * as _ from './helper'
import { FIELD_CLASSES } from '../constants'

/**
  * Retrieves the internal document IDs that match the filter.
  *
  *   - A filter is either an object or an array of objects. 
  *   - Properties specify the field to filter for OR one of the boolean expressions "$and", "$or" or "$not".
  *   - Specifying an array (e.g., of numbers) instead of an exact filter term always assumes that any of them can match.
  *   - If there are multiple properties or objects defining filters, they're by default used to find documents that match all filters, EXCEPT a custom boolean filter has been specified in the parent level (in nested filters). 
  *
  * Examples:
  *   
  *   { tags: ["a", "b"] } => Find documents with either tags=a or tags=b (or both).
  *   { $and: [{ tags: "a" }, { tags: "b" }] } => Document tags must include both a and b.
  *   { $not: { tags: ["a", "b"] } } => Every document without tags a or b
  *   { $not: { createdAt: { $lt: "2022-01-01T00:00:00Z" } } } => Documents from 2022 or later
  *   { $or: { createdAt: { $gte: "2022-01-01T00:00:00Z" }, $and: [{ tags: "a" }, { tags: "b" }] } } => Documents from 2022 or later or earlier ones with both tags a,b.
  *
  */
export const evaluateFilter = (
  index: Index,
  filter: any, // TODO: interface?
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

  throw new Error('Invalid filter.')
}


import { 
  SearchIndex,
  NumberFieldIndex,
  KeywordFieldIndex
} from '../interfaces'
import { binarySearch } from './binary-search'
import * as _ from './helper'

export const evaluateFilter = (
  index: SearchIndex,
  filter: any,
  operator = '$and'
): number[] => {
  const keys = Object.keys(filter)

  let operands: number[][] = []
  if (typeof filter === 'object') {
    for (const [key, value] of Object.entries(filter)) {
      const fieldMappingType =_.get(index.mappings, key) 

      if (fieldMappingType) {
        operands.push(getDocumentIdsForFilter(index, key, fieldMappingType, value))
        continue
      }

      if (['$and', '$or', '$not'].includes(key)) {
        operands.push(evaluateFilter(index, value, key))
        continue
      }

      throw new Error(`The field '${fieldMappingType}' does not exist in index and cannot be used for filtering.`)
    }
  } else if (Array.isArray(filter)) {
    operands = filter.map(f => evaluateFilter(index, f)) 
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
    return Object.values(index.ids)
      .filter(id => !union.includes(id))
  }

  throw new Error('')
}

const applyKeywordFilter = (index: SearchIndex, field: string, keyword: string): number[] =>
  (index.fields[field] as KeywordFieldIndex)[keyword]

const applyNumberFilter = (index: SearchIndex, field: string, num: number): number[] => {
  const foundIndex =  binarySearch(
    num,
    (index.fields[field] as NumberFieldIndex),
    false,
    ([value]) => value
  )

  if (foundIndex > -1) {
   return (index.fields[field] as NumberFieldIndex)[foundIndex][1]
  }

  return []
}

const isRangeQuery = (obj: any) => typeof obj === 'object' && 
  ['$gt', '$gte', '$lt', '$lte'].filter(k => obj[k]).length > 0

export const getDocumentIdsForFilter = (
  index: SearchIndex,
  field: string,
  fieldMappingType: 'keyword',
  filter: string | string[] | any
): number[] => {
  if (fieldMappingType === 'keyword') {
    if (Array.isArray(filter)) {
      const invalidArrayItem = filter.find(item => typeof item !== 'string')
      if (invalidArrayItem) {
        throw new Error(`Invalid value '${invalidArrayItem}' provided for filtering the '${field}' field.`)
      }

      return [
        ...new Set(
          (filter as string[]).flatMap(keyword => applyKeywordFilter(index, field, keyword))
        )
      ]
    } else if (typeof filter === 'string') {
      return [...new Set(applyKeywordFilter(index, field, filter))]
    } else {
      throw new Error(`Invalid value '${filter}' provided for filtering the '${field}' field.`)
    }
  } else if (fieldMappingType === 'number') {
    if (Array.isArray(filter)) {
      const invalidArrayItem = filter.find(item => typeof item !== 'number')
      if (invalidArrayItem) {
        throw new Error(`Invalid value '${invalidArrayItem}' provided for filtering the '${field}' field.`)
      }

      return [...new Set((filter as number[]).flatMap(num => applyNumberFilter(index, field, num)))]
    } else if (typeof filter === 'number') {
      return [...new Set(applyNumberFilter(index, field, filter))]
    } else if (isRangeQuery(filter)) {
      let minIndex = 0
      let maxIndex = (index.fields[field] as NumberFieldIndex).length - 1

      if (filter['$gt']) {
        minIndex = binarySearch(
          filter,
          (index.fields[field] as NumberFieldIndex),
          true,
          ([value]) => value
        )
      } 

      if (filter['$gte']) {
        minIndex = 1 + binarySearch(
          filter,
          (index.fields[field] as NumberFieldIndex),
          true,
          ([value]) => value
        )
      }

      if (filter['$lt']) {
        maxIndex = binarySearch(
          filter,
          (index.fields[field] as NumberFieldIndex),
          true,
          ([value]) => value
        )
      } 

      if (filter['$lte']) {
        // TODO: make it exact
        maxIndex = binarySearch(
          filter,
          (index.fields[field] as NumberFieldIndex),
          true,
          ([value]) => value
        )
      }

      return [...new Set((index.fields[field] as NumberFieldIndex)
        .slice(minIndex, maxIndex)
        .flatMap(([num, docIds]) => docIds)
      )]
    } else {
      throw new Error(`Invalid value '${filter}' provided for filtering the '${field}' field.`)
    }
  } else if (fieldMappingType === 'date') {
    throw new Error('not implemented')    
  }

  throw new Error(`Mapping type '${fieldMappingType}' on field '${field}' cannot be used for filtering.`)
}

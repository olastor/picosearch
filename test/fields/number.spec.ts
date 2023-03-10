import NumberField from '../../src/fields/number'
import * as _ from '../../src/utils/helper'
import { test, fc } from '@fast-check/jest';

describe('Number Field', () => {
  test('should initalize field', () => {
    expect(NumberField.initialize()).toEqual([])
  })

  test('should index documents in correct order', () => {
    fc.assert(fc.property(fc.array(fc.integer()), (ints: number[]) => {
      const field = NumberField.initialize()
      ints.forEach((i, docID) => NumberField.indexDocument(field, docID, i))
      const values = field.map(x => x[0])
      const valuesSorted = JSON.parse(JSON.stringify(values)).sort((a: number, b: number) => a - b)
      for (let i = 0; i < values.length; i++) {
        if (values[i] !== valuesSorted[i]) return false
      }
      return true
    }))
  })

  test.prop([
    fc.array(fc.integer())
      .chain(arr => fc.tuple(
        fc.constant(arr), 
        fc.shuffledSubarray([...Array(arr.length).keys()], { minLength: arr.length })
      ))
  ])('should delete documents', ([ints, randomIndices]: [number[], number[]]) => {
    const field = NumberField.initialize()
    ints.forEach((i, docId) => NumberField.indexDocument(field, docId, i))
    for (let i = 0; i < randomIndices.length; i++) {
      const docId = randomIndices[i]
      const value = ints[docId]
      NumberField.removeDocument(field, docId)
      
      const valueIndex = field.findIndex(v => v[0] == value)
      if (valueIndex > -1 && (field[valueIndex] as [number, number[]])[1].includes(docId)) {
        return false
      }
    }

    return field.length === 0
  })

  test.prop([fc.array(fc.integer())])('should filter documents using exact match', (ints: number[]) => {
    const field = NumberField.initialize()
    ints.forEach((i, docId) => NumberField.indexDocument(field, docId, i))
    for (const i of ints) {
      const expectedDocIds = ints
        .map((val, docId) => [val, docId])
        .filter(x => x[0] === i)
        .map(x => x[1])

      if (_.union([expectedDocIds, NumberField.filterDocuments(field, i)]).length > expectedDocIds.length) {
        return false
      }
    }
  })

  test.prop([fc.uniqueArray(fc.integer())])('should filter correctly if filtering for all items', (ints: number[]) => {
    const field = NumberField.initialize()
    ints.forEach((i, docId) => NumberField.indexDocument(field, docId, i))
    const indices = [...new Set(NumberField.filterDocuments(field, ints))].sort()

    if (ints.length === 0) {
      return indices.length === 0
    }

    return indices.length === ints.length && 
      indices[0] === 0 && 
      indices[indices.length - 1] === ints.length - 1
  })
})

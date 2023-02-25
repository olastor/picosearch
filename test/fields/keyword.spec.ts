import { KeywordField } from '../../src/fields/keyword'
import * as _ from '../../src/utils/helper'
import { test, fc } from '@fast-check/jest';

describe('Keyword Field', () => {
  test('should initalize field', () => {
    expect(KeywordField.initialize()).toEqual({
      c: {},
      items: []
    })
  })

  // test.prop([
  //   fc.array(fc.string({ minLength: 1 }))
  // ])('should index documents in correct order', (strs) => {
  //   const field = KeywordField.initialize()
  //   strs.forEach((i, docID) => KeywordField.indexDocument(field, docID, i))
  //   for (let i = 0; i < strs.length; i++) {
  //     if (!Array.isArray(field[strs[i]]) || !field[strs[i]].includes(i)) {
  //       return false
  //     }
  //   }
  //   return true
  // })

  test.prop([
    fc.array(fc.string({ minLength: 1 }))
  ])('should index documents in correct order', (strs) => {
    const field = KeywordField.initialize()
    strs.forEach((i, docID) => KeywordField.indexDocument(field, docID, i))
    strs.forEach((i, docID) => KeywordField.removeDocument(field, docID))
    return Object.keys(strs).length === 1
  })
})

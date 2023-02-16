import { NumberField } from '../src/fields/number'

import fc from 'fast-check'

describe('Number Field', () => {
  test('should initalize field', () => {
    expect(NumberField.initialize()).toEqual([])
  })

  test('should index documents in correct order', () => {
    fc.assert(fc.property(fc.array(fc.integer()), (ints: number[]) => {
      const field = NumberField.initialize()
      ints.forEach((i, j) => NumberField.indexDocument(field, j, i))
      const values = field.map(x => x[0])
      const valuesSorted = JSON.parse(JSON.stringify(values)).sort((a: number, b: number) => a - b)
      for (let i = 0; i < values.length; i++) {
        if (values[i] !== valuesSorted[i]) return false
      }
      return true
    }))
  })

})

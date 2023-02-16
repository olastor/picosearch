import { KeywordField } from '../src/fields/number'

import fc from 'fast-check'

describe('Number Field', () => {
  test('should initalize field', () => {
    expect(KeywordField.initialize()).toEqual({})
  })
})

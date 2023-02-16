import { binarySearch } from '../src/utils/binary-search'
import fc from 'fast-check'


describe('Binary Search', () => {
  test('should throw for empty array', () => {
    expect(() => binarySearch(4, [])).toThrow(Error)
  })

  test('should return 0 for empty array and clostest index', () => {
    expect(binarySearch(4, [], true)).toBe(0)
  })

  test('should find element', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer(), { minLength: 1 }).chain(arr => fc.tuple(
          fc.constant(arr.sort((a, b) => (a - b))),
          fc.integer({ min: 0, max: arr.length - 1 })
        )), ([arr, randomIndex]) => {
          return randomIndex === binarySearch(arr[randomIndex], arr)
        }),
        { verbose: true }
    )
  })

  test('should find closest element', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer(), { minLength: 1 }).chain(arr => fc.tuple(
          fc.constant(arr.sort((a, b) => (a - b))),
          fc.integer({ min: 0, max: arr.length - 1 }).filter(x => !arr.includes(x))
        )), ([arr, missingValue]) => {
          let i = arr.findIndex(x => missingValue < x)
          i = i === -1 ? arr.length : i
          return binarySearch(missingValue, arr, true) === i
        }),
        { verbose: true }
    )
  })

  test('should throw if element does not exist', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer(), { minLength: 1 }).chain(arr => fc.tuple(
          fc.constant(arr.sort((a, b) => (a - b))),
          fc.integer({ min: 0, max: arr.length - 1 }).filter(x => !arr.includes(x))
        )), ([arr, missingValue]) => {
          expect(() => binarySearch(missingValue, arr)).toThrow(Error)
          return true
        }),
        { verbose: true }
    )
  })
})

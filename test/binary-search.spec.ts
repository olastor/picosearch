import { binarySearch } from '../src/utils/binary-search'
import { test, fc } from '@fast-check/jest';

fc.configureGlobal({ 
  verbose: true, 
  numRuns: 100000, 
  endOnFailure: true
});


describe('Binary Search', () => {
  test('should return -1 for empty array', () => {
    expect(binarySearch(4, [])).toBe(-1)
  })

  test('should return 0 for empty array and clostest index', () => {
    expect(binarySearch(4, [], true)).toBe(0)
  })

  test.prop([
    fc.uniqueArray(fc.integer(), { minLength: 1, maxLength: 10000 }).chain(arr => fc.tuple(
      fc.constant(arr.sort((a, b) => (a - b))),
      fc.integer({ min: 0, max: arr.length - 1 })
    ))
  ])('should find element', ([arr, randomIndex]) => {
    return randomIndex === binarySearch(arr[randomIndex], arr)
  })

  test.prop([
    fc.uniqueArray(fc.integer(), { minLength: 1, maxLength: 10000 }).chain(arr => fc.tuple(
      fc.constant(arr),
      fc.integer().filter(x => !arr.includes(x))
    ))
  ])('should return -1 or find closest element', ([arr, missingValue]) => {
    arr.sort((a, b) => (a - b))
    let i = arr.findIndex(x => missingValue < x)
    i = i === -1 ? arr.length : i
    const exactMatch =  binarySearch(missingValue, arr)
    const closestMatch = binarySearch(missingValue, arr, true)
    return exactMatch === -1 && closestMatch === i
  })
})

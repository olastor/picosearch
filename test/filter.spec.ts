import { evaluateFilter } from '../src/utils/filter'
import { 
  indexDocument,
  createIndex
} from '../src/'
import { test, fc } from '@fast-check/jest';

fc.configureGlobal({ verbose: true, numRuns: 1000000, endOnFailure: true });

describe('Filter', () => {
  describe('Basic Filters & Boolean Logic', () => {
    test('should filter simple filter', () => {
      const index = createIndex({ a: 'number' })
      const docs = [1, 2, 3, 4, 5]
      docs.forEach(i => indexDocument(index, { _id: i, a: i }))
      const filtered = evaluateFilter(index, { a: 2 })
      expect(filtered.length).toEqual(1)
      expect(index.originalIds[filtered[0]]).toEqual(2)
    })

    test('should filter array fields', () => {
      const index = createIndex({ a: 'number' })
      const docs = [1, 2, 3, 4, 5]
      docs.forEach(i => indexDocument(index, { _id: i, a: i }))
      const filtered = evaluateFilter(index, { a: [2, 3] })
      const ids = filtered.map(x => index.originalIds[x]).sort()
      expect(ids).toEqual([2, 3])
    })

    test('should filter multiple fields', () => {
      const index = createIndex({ a: 'number', b: 'number' })
      const docs = [1, 2, 3, 4, 5]
      docs.forEach(i => indexDocument(index, { _id: i, a: i, b: i + 1 }))
      const filtered = evaluateFilter(index, { a: 2, b: 3 })
      const ids = filtered.map(x => index.originalIds[x]).sort()
      expect(ids).toEqual([2])
    })

    test('should filter $or filter', () => {
      const index = createIndex({ a: 'number', b: 'number' })
      const docs = [1, 2, 3, 4, 5]
      docs.forEach(i => indexDocument(index, { _id: i, a: i, b: i + 1 }))
      const filtered = evaluateFilter(index, { $or: { a: [2, 3], b: 5 }})
      const ids = filtered.map(x => index.originalIds[x]).sort()
      expect(ids).toEqual([2, 3, 4])
    })

    test('should filter $and filter', () => {
      const index = createIndex({ a: 'number', b: 'number' })
      const docs = [1, 2, 3, 4, 5]
      docs.forEach(i => indexDocument(index, { _id: i, a: i, b: i + 1 }))
      const filtered = evaluateFilter(index, { $and: { a: [2, 3, 4], b: 5 }})
      const ids = filtered.map(x => index.originalIds[x]).sort()
      expect(ids).toEqual([4])
    })

    test('should filter $not filter', () => {
      const index = createIndex({ a: 'number', b: 'number' })
      const docs = [1, 2, 3, 4, 5]
      docs.forEach(i => indexDocument(index, { _id: i, a: i, b: i + 1 }))
      const filtered = evaluateFilter(index, { $not: { a: 3 } })
      const ids = filtered.map(x => index.originalIds[x]).sort()
      expect(ids).toEqual([1, 2, 4, 5])
    })

    test('should filter nested filter', () => {
      const index = createIndex({ a: 'number', b: 'number' })
      const docs = [1, 2, 3, 4, 5]
      docs.forEach(i => indexDocument(index, { _id: i, a: i, b: i + 1 }))
      const filtered = evaluateFilter(index, { 
        $not: {
          $and: [
            { $or: { a: 1, b: 3 } },
            { $or: [{ a: 2 }, { a: 3 }] }
          ]
        }
      })
      const ids = filtered.map(x => index.originalIds[x]).sort()
      expect(ids).toEqual([1, 3, 4, 5])
    })
  })

  describe('Number Range Filters', () => {
    test('should filter range filter', () => {
      const index = createIndex({ a: 'number' })
      const docs = [1, 2, 3, 4, 5]
      docs.forEach(i => indexDocument(index, { _id: i, a: i }))
      const filtered = evaluateFilter(index, { a: { $gte: 2, $lt: 5 }})
      const ids = filtered.map(x => index.originalIds[x]).sort()
      expect(ids).toEqual([2, 3, 4])
    })

    test.prop([
      fc.array(fc.integer(), { minLength: 1 }),
      fc.integer(),
      fc.integer(),
      fc.oneof(fc.constant('$lt'), fc.constant('$lte')),
      fc.oneof(fc.constant('$gt'), fc.constant('$gte'))
    ])('should apply random ranges correctly', (
      ints: number[], 
      a,
      b,
      lt,
      gt
    ) => {
      const min = a > b ? b : a
      const max = a < b ? b : a
      const index = createIndex({ a: 'number' })
      const docs = ints.map((a, j) => ({ _id: j, a }))
      docs.forEach((doc) => indexDocument(index, doc))
      const isEqual = (a: number[], b: number[]) => 
        a.length === b.length && 
        !a.find(x => !b.includes(x)) && 
        !b.find(x => !a.includes(x))

      const filtered = evaluateFilter(index, { a: { [gt]: min, [lt]: max }})
      const ids = filtered.map(x => index.originalIds[x]) as number[]
      const expected = docs
        .filter(doc => 
          (gt.includes('e') ? doc.a >= min : doc.a > min) && 
          (lt.includes('e') ? doc.a <= max : doc.a < max)
        )
        .map(doc => doc._id)

      return isEqual(expected, ids)
    })
  })
})

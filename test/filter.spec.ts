import { evaluateFilter } from '../src/utils/filter'
import { 
  indexDocument,
  createIndex
} from '../src/'
import { Index } from '../src/interfaces'
import { test, fc } from '@fast-check/jest';

const getOriginalIdByInternalId = (index: Index, internalId: number): string => 
  index.originalIds[internalId - index.internalIds.missing.filter((x: number) => x < internalId).length]

const getInternalIdByOriginalId = (index: Index, originalId: string): number => {
  const i = index.originalIds.indexOf(originalId)
  if (i === -1) {
    throw new Error('ID not found: ' + originalId)
  }

  return i + index.internalIds.missing.filter((x: number) => x < i).length
}

fc.configureGlobal({ verbose: true, numRuns: 10000, endOnFailure: true });

describe('Filter', () => {
  describe('Basic Filters & Boolean Logic', () => {
    test('should filter simple filter', () => {
      const index = createIndex({ a: 'number' })
      const docs = [1, 2, 3, 4, 5]
      docs.forEach(i => indexDocument(index, { _id: i, a: i }))
      const filtered = evaluateFilter(index, { a: 2 })
      expect(filtered.length).toEqual(1)
      expect(getOriginalIdByInternalId(index, filtered[0])).toEqual('2')
    })

    test('should filter array fields', () => {
      const index = createIndex({ a: 'number' })
      const docs = [1, 2, 3, 4, 5]
      docs.forEach(i => indexDocument(index, { _id: i, a: i }))
      const filtered = evaluateFilter(index, { a: [2, 3] })
      const ids = filtered.map(x => getOriginalIdByInternalId(index, x)).sort()
      expect(ids).toEqual([2, 3].map(x => String(x)))
    })

    test('should filter multiple fields', () => {
      const index = createIndex({ a: 'number', b: 'number' })
      const docs = [1, 2, 3, 4, 5]
      docs.forEach(i => indexDocument(index, { _id: i, a: i, b: i + 1 }))
      const filtered = evaluateFilter(index, { a: 2, b: 3 })
      const ids = filtered.map(x => getOriginalIdByInternalId(index, x)).sort()
      expect(ids).toEqual([2].map(x => String(x)))
    })

    test('should filter $or filter', () => {
      const index = createIndex({ a: 'number', b: 'number' })
      const docs = [1, 2, 3, 4, 5]
      docs.forEach(i => indexDocument(index, { _id: i, a: i, b: i + 1 }))
      const filtered = evaluateFilter(index, { $or: { a: [2, 3], b: 5 }})
      const ids = filtered.map(x => getOriginalIdByInternalId(index, x)).sort()
      expect(ids).toEqual([2, 3, 4].map(x => String(x)))
    })

    test('should filter $and filter', () => {
      const index = createIndex({ a: 'number', b: 'number' })
      const docs = [1, 2, 3, 4, 5]
      docs.forEach(i => indexDocument(index, { _id: i, a: i, b: i + 1 }))
      const filtered = evaluateFilter(index, { $and: { a: [2, 3, 4], b: 5 }})
      const ids = filtered.map(x => getOriginalIdByInternalId(index, x)).sort()
      expect(ids).toEqual([4].map(x => String(x)))
    })

    test('should filter $not filter', () => {
      const index = createIndex({ a: 'number', b: 'number' })
      const docs = [1, 2, 3, 4, 5]
      docs.forEach(i => indexDocument(index, { _id: i, a: i, b: i + 1 }))
      const filtered = evaluateFilter(index, { $not: { a: 3 } })
      const ids = filtered.map(x => getOriginalIdByInternalId(index, x)).sort()
      expect(ids).toEqual([1, 2, 4, 5].map(x => String(x)))
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
      const ids = filtered.map(x => getOriginalIdByInternalId(index, x)).sort()
      expect(ids).toEqual([1, 3, 4, 5].map(x => String(x)))
    })
  })

  describe('Number Range Filters', () => {
    test('should filter range filter', () => {
      const index = createIndex({ a: 'number' })
      const docs = [1, 2, 3, 4, 5]
      docs.forEach(i => indexDocument(index, { _id: i, a: i }))
      const filtered = evaluateFilter(index, { a: { $gte: 2, $lt: 5 }})
      const ids = filtered.map(x => getOriginalIdByInternalId(index, x)).sort()
      expect(ids).toEqual([2, 3, 4].map(x => String(x)))
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
      const docs = ints.map((a, j) => ({ _id: String(j), a }))
      docs.forEach((doc) => indexDocument(index, doc))
      const isEqual = (a: string[], b: string[]) => 
        a.length === b.length && 
        !a.find(x => !b.includes(x)) && 
        !b.find(x => !a.includes(x))

      const filtered = evaluateFilter(index, { a: { [gt]: min, [lt]: max }})
      const ids = filtered.map(x => getOriginalIdByInternalId(index, x)).sort()
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

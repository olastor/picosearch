import { buildSearchIndex, querySearchIndex, DEFAULT_SEARCH_OPTIONS } from '../src/index'

// examples copied from: https://www.elastic.co/de/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables
const testDocs1 = ['Shane', 'Shane C', 'Shane P Connelly', 'Shane Connelly', 'Shane Shane Connelly Connelly', 'Shane Shane Shane Connelly Connelly Connelly']

describe('TinySearch', () => {
  describe('Options', () => {
    test('tokenizer should work', () => {
      const options = {
        ...DEFAULT_SEARCH_OPTIONS,
        tokenizer: (s: string) => s.split('_'),
        bm25: {
          b: 0.5,
          k1: 0
        }
      }

      const index1 = buildSearchIndex(['tommy_tommy', 'tommy_tommy', 'tommy_tommy'], options)
      const results = querySearchIndex('tommy', index1, options)
      expect(results).toEqual([
        { docId: 0, score: 0.13353139262452257 },
        { docId: 1, score: 0.13353139262452257 },
        { docId: 2, score: 0.13353139262452257 }
      ])
    })

    test('lowercasing should work', () => {
      const options = {
        ...DEFAULT_SEARCH_OPTIONS,
        bm25: {
          b: 0.5,
          k1: 0
        }
      }

      const index1 = buildSearchIndex(['Tommy', 'Tommy', 'Tommy'], options)
      const results = querySearchIndex('ToMmy', index1, options)
      expect(results).toEqual([
        { docId: 0, score: 0.13353139262452257 },
        { docId: 1, score: 0.13353139262452257 },
        { docId: 2, score: 0.13353139262452257 }
      ])
    })

    test('custom transformation should work', () => {
      const options = {
        ...DEFAULT_SEARCH_OPTIONS,
        customTransformation: () => 'peter',
        bm25: {
          b: 0.5,
          k1: 0
        }
      }

      const index1 = buildSearchIndex(['tommy! shane', 'tommy! shane', 'tommy! shane'], options)
      const results = querySearchIndex('peter', index1, options)
      expect(results).toEqual([
        { docId: 0, score: 0.13353139262452257 },
        { docId: 1, score: 0.13353139262452257 },
        { docId: 2, score: 0.13353139262452257 }
      ])
    })

    test('punctuation stripping should work', () => {
      const options = {
        ...DEFAULT_SEARCH_OPTIONS,
        bm25: {
          b: 0.5,
          k1: 0
        }
      }

      const index1 = buildSearchIndex(['tommy! shane', 'tommy! shane', 'tommy! shane'], options)
      const results2 = querySearchIndex('tommy', index1, options)
      expect(results2).toEqual([
        { docId: 0, score: 0.13353139262452257 },
        { docId: 1, score: 0.13353139262452257 },
        { docId: 2, score: 0.13353139262452257 }
      ])
    })

    test('stopwords should work', () => {
      const options = {
        ...DEFAULT_SEARCH_OPTIONS,
        stopwords: ['shane'],
        bm25: {
          b: 0.5,
          k1: 0
        }
      }

      const index1 = buildSearchIndex(['tommy shane', 'tommy shane', 'tommy shane'], options)
      const results1 = querySearchIndex('shane', index1, options)
      const results2 = querySearchIndex('tommy', index1, options)
      expect(results1).toEqual([])
      expect(results2).toEqual([
        { docId: 0, score: 0.13353139262452257 },
        { docId: 1, score: 0.13353139262452257 },
        { docId: 2, score: 0.13353139262452257 }
      ])
    })

    test('stemmer should work', () => {
      const options = {
        ...DEFAULT_SEARCH_OPTIONS,
        stemmer: () => 'tommy',
        bm25: {
          b: 0.5,
          k1: 0
        }
      }

      const index1 = buildSearchIndex(['shane', 'shane', 'shane'], options)
      const results = querySearchIndex('tommy', index1, options)
      expect(results).toEqual([
        { docId: 0, score: 0.13353139262452257 },
        { docId: 1, score: 0.13353139262452257 },
        { docId: 2, score: 0.13353139262452257 }
      ])
    })

    test('size limit should work', () => {
      const options = {
        ...DEFAULT_SEARCH_OPTIONS,
        bm25: {
          b: 0.5,
          k1: 0
        }
      }

      const index1 = buildSearchIndex(['shane', 'shane', 'shane'], options)
      const results = querySearchIndex('shane', index1, options, 2)
      expect(results).toEqual([
        { docId: 0, score: 0.13353139262452257 },
        { docId: 1, score: 0.13353139262452257 }
      ])
    })
  })

  describe('BM25 Algorithm', () => {
    test('example query should have correct scores (1)', () => {
      const options = {
        ...DEFAULT_SEARCH_OPTIONS,
        bm25: {
          b: 0.5,
          k1: 0
        }
      }

      const index1 = buildSearchIndex(testDocs1, options)
      const results = querySearchIndex('shane', index1, options)
      const scores = results.map(x => x.score)

      // the score is uniform and equal to the idf
      expect(Math.max(...scores)).toBe(0.07410797215372183);
      expect(Math.min(...scores)).toBe(0.07410797215372183);
      expect(results.length).toBe(6)
    });

    test('example query should have correct scores (2)', () => {
      const options = {
        ...DEFAULT_SEARCH_OPTIONS,
        bm25: {
          b: 0,
          k1: 10
        }
      }

      const index1 = buildSearchIndex(testDocs1, options)
      const results = querySearchIndex('shane', index1, options)

      expect(results).toEqual([
        { docId: 5, score: 0.18812023700560157 },
        { docId: 4, score: 0.1358646156151567 },
        { docId: 0, score: 0.07410797215372183 },
        { docId: 1, score: 0.07410797215372183 },
        { docId: 2, score: 0.07410797215372183 },
        { docId: 3, score: 0.07410797215372183 }
      ])
    });

    test('example query should have correct scores (3)', () => {
      const options = {
        ...DEFAULT_SEARCH_OPTIONS,
        bm25: {
          b: 1,
          k1: 5
        }
      }

      const index1 = buildSearchIndex(testDocs1, options)
      const results = querySearchIndex('shane', index1, options)

      expect(results).toEqual([
        { docId: 0, score: 0.16674293734587414 },
        { docId: 1, score: 0.10261103836669179 },
        { docId: 3, score: 0.10261103836669179 },
        { docId: 4, score: 0.10261103836669179 },
        { docId: 5, score: 0.10261103836669178 },
        { docId: 2, score: 0.07410797215372183 }
      ])
    });

    test('example query should have correct scores (4)', () => {
      const options = {
        ...DEFAULT_SEARCH_OPTIONS,
        bm25: {
          b: 1,
          k1: 5
        }
      }

      const index1 = buildSearchIndex(testDocs1, options)
      const results = querySearchIndex('shane connelly', index1, options)

      expect(results).toEqual([
        { docId: 3, score: 0.7143794645992078 },
        { docId: 4, score: 0.7143794645992078 },
        { docId: 5, score: 0.7143794645992076 },
        { docId: 2, score: 0.5159407244327611 },
        { docId: 0, score: 0.16674293734587414 },
        { docId: 1, score: 0.10261103836669179 }
      ])
    });
  })
});

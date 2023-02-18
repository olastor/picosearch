import { 
  indexDocument,
  createIndex,
  searchIndex,
  DEFAULT_ANALYZER,
  DEFAULT_QUERY_OPTIONS
} from '../src/'

// examples copied from: https://www.elastic.co/de/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables
const testDocs1 = ['Shane', 'Shane C', 'Shane P Connelly', 'Shane Connelly', 'Shane Shane Connelly Connelly', 'Shane Shane Shane Connelly Connelly Connelly']

describe('Main', () => {
  describe('Options', () => {
    test('tokenizer should work', () => {
      const analyzer = {
        ...DEFAULT_ANALYZER,
        tokenizer: (s: string) => s.split('_'),
      }

      const options = {
        ...DEFAULT_QUERY_OPTIONS,
        bm25: {
          b: 0.5,
          k1: 0
        }
      }

      const index1 = createIndex({ text: 'text' })

      const docs = ['tommy_tommy', 'tommy_tommy', 'tommy_tommy']
      docs.forEach((text, i) => indexDocument(index1, { _id: `doc-${i}`, text }, analyzer))

      const results = searchIndex(index1, 'tommy', options, analyzer)
      expect(results).toEqual({
        hits: [
          { _id: 'doc-0', _score: 0.13353139262452257 }, 
          { _id: 'doc-1', _score: 0.13353139262452257 }, 
          { _id: 'doc-2', _score: 0.13353139262452257 }
        ], 
        maxScore: 0.13353139262452257, 
        total: 3
      })
    })

    test('lowercasing should work', () => {
      const options = {
        ...DEFAULT_QUERY_OPTIONS,
        bm25: {
          b: 0.5,
          k1: 0
        }
      }

      const index1 = createIndex({ text: 'text' })
      const docs = ['Tommy', 'Tommy', 'Tommy']
      docs.forEach((text, i) => indexDocument(index1, { _id: `doc-${i}`, text }))
      const results = searchIndex(index1, 'ToMmy', options, DEFAULT_ANALYZER)
      expect(results).toEqual({"hits": [{"_id": "doc-0", "_score": 0.13353139262452257}, {"_id": "doc-1", "_score": 0.13353139262452257}, {"_id": "doc-2", "_score": 0.13353139262452257}], "maxScore": 0.13353139262452257, "total": 3})
    })

    test('custom transformation should work', () => {
      const analyzer = {
        customTransformation: () => 'peter'
      }

      const options = {
        ...DEFAULT_QUERY_OPTIONS,
        bm25: {
          b: 0.5,
          k1: 0
        }
      }

      const index1 = createIndex({ text: 'text' })
      const docs = ['tommy! shane', 'tommy! shane', 'tommy! shane']
      docs.forEach((text, i) => indexDocument(index1, { _id: `doc-${i}`, text }, analyzer))
      const results = searchIndex(index1, 'peter', options, analyzer)
      expect(results).toEqual({"hits": [{"_id": "doc-0", "_score": 0.13353139262452257}, {"_id": "doc-1", "_score": 0.13353139262452257}, {"_id": "doc-2", "_score": 0.13353139262452257}], "maxScore": 0.13353139262452257, "total": 3})
    })

    test('punctuation stripping should work', () => {
      const options = {
        ...DEFAULT_QUERY_OPTIONS,
        bm25: {
          b: 0.5,
          k1: 0
        }
      }

      const index1 = createIndex({ text: 'text' })
      const docs = ['tommy! shane', 'tommy! shane', 'tommy! shane']
      docs.forEach((text, i) => indexDocument(index1, { _id: `doc-${i}`, text }))
      const results = searchIndex(index1, 'tommy', options)
      expect(results).toEqual({"hits": [{"_id": "doc-0", "_score": 0.13353139262452257}, {"_id": "doc-1", "_score": 0.13353139262452257}, {"_id": "doc-2", "_score": 0.13353139262452257}], "maxScore": 0.13353139262452257, "total": 3})
    })

    test('stopwords should work', () => {
      const analyzer = {
        stopwords: ['shane'],
      }

      const options = {
        ...DEFAULT_QUERY_OPTIONS,
        bm25: {
          b: 0.5,
          k1: 0
        }
      }

      const index1 = createIndex({ text: 'text' })
      const docs = ['tommy! shane', 'tommy! shane', 'tommy! shane']
      docs.forEach((text, i) => indexDocument(index1, { _id: `doc-${i}`, text }, analyzer))
      const results1 = searchIndex(index1, 'tommy', options, analyzer)
      const results2 = searchIndex(index1, 'shane', options, analyzer)
      expect(results1).toEqual({"hits": [{"_id": "doc-0", "_score": 0.13353139262452257}, {"_id": "doc-1", "_score": 0.13353139262452257}, {"_id": "doc-2", "_score": 0.13353139262452257}], "maxScore": 0.13353139262452257, "total": 3})
      expect(results2).toEqual({hits: [], maxScore: 0, total: 0})
    })

    // test('stemmer should work', () => {
    //   const options = {
    //     ...DEFAULT_QUERY_OPTIONS,
    //     stemmer: () => 'tommy',
    //     bm25: {
    //       b: 0.5,
    //       k1: 0
    //     }
    //   }

    //   const index1 = buildSearchIndex(['shane', 'shane', 'shane'], options)
    //   const results = querySearchIndex('tommy', index1, options)
    //   expect(results).toEqual([
    //     { docId: 0, score: 0.13353139262452257 },
    //     { docId: 1, score: 0.13353139262452257 },
    //     { docId: 2, score: 0.13353139262452257 }
    //   ])
    // })

    // test('size limit should work', () => {
    //   const options = {
    //     ...DEFAULT_QUERY_OPTIONS,
    //     bm25: {
    //       b: 0.5,
    //       k1: 0
    //     }
    //   }

    //   const index1 = buildSearchIndex(['shane', 'shane', 'shane'], options)
    //   const results = querySearchIndex('shane', index1, options, 2)
    //   expect(results).toEqual([
    //     { docId: 0, score: 0.13353139262452257 },
    //     { docId: 1, score: 0.13353139262452257 }
    //   ])
    // })
  })

  describe('BM25F', () => {
    test('example query should have correct scores (1)', () => {
      const options = {
        bm25: {
          b: 0.5,
          k1: 0
        }
      }

      const index1 = createIndex({ text: 'text' })
      testDocs1.forEach((text, i) => indexDocument(index1, { _id: `doc-${i}`, text }))
      const results = searchIndex(index1, 'shane', options)
      const scores = results.hits.map(x => x._score)

      // the score is uniform and equal to the idf
      expect(Math.max(...scores)).toBe(0.07410797215372183);
      expect(Math.min(...scores)).toBe(0.07410797215372183);
      expect(results.total).toBe(6)
    });

    test('example query should have correct scores (2)', () => {
      const options = {
        ...DEFAULT_QUERY_OPTIONS,
        bm25: {
          b: 0,
          k1: 10
        }
      }

      const index1 = createIndex({ text: 'text' })
      testDocs1.forEach((text, i) => indexDocument(index1, { _id: `doc-${i}`, text }))
      const results = searchIndex(index1, 'shane', options)

      expect(results).toEqual([
        { docId: 5, score: 0.18812023700560157 },
        { docId: 4, score: 0.1358646156151567 },
        { docId: 0, score: 0.07410797215372183 },
        { docId: 1, score: 0.07410797215372183 },
        { docId: 2, score: 0.07410797215372183 },
        { docId: 3, score: 0.07410797215372183 }
      ])
    });

    // test('example query should have correct scores (3)', () => {
    //   const options = {
    //     ...DEFAULT_QUERY_OPTIONS,
    //     bm25: {
    //       b: 1,
    //       k1: 5
    //     }
    //   }

    //   const index1 = buildSearchIndex(testDocs1, options)
    //   const results = querySearchIndex('shane', index1, options)

    //   expect(results).toEqual([
    //     { docId: 0, score: 0.16674293734587414 },
    //     { docId: 1, score: 0.10261103836669179 },
    //     { docId: 3, score: 0.10261103836669179 },
    //     { docId: 4, score: 0.10261103836669179 },
    //     { docId: 5, score: 0.10261103836669178 },
    //     { docId: 2, score: 0.07410797215372183 }
    //   ])
    // });

    // test('example query should have correct scores (4)', () => {
    //   const options = {
    //     ...DEFAULT_QUERY_OPTIONS,
    //     bm25: {
    //       b: 1,
    //       k1: 5
    //     }
    //   }

    //   const index1 = buildSearchIndex(testDocs1, options)
    //   const results = querySearchIndex('shane connelly', index1, options)

    //   expect(results).toEqual([
    //     { docId: 3, score: 0.7143794645992078 },
    //     { docId: 4, score: 0.7143794645992078 },
    //     { docId: 5, score: 0.7143794645992076 },
    //     { docId: 2, score: 0.5159407244327611 },
    //     { docId: 0, score: 0.16674293734587414 },
    //     { docId: 1, score: 0.10261103836669179 }
    //   ])
    // });
  // })

  // describe('Highlighting', () => {
    // test('highlighting should work', () => {
    //   const stemmer = (s: string) => s === 'dogs' ? 'dog' : s
    //   const options = {
    //     ...DEFAULT_QUERY_OPTIONS,
    //     stemmer
    //   }

    //   const doc = ' The dog   is      playing  with other dogs  .   '
    //   const docExpected = ' The <em>dog</em>   is      playing  with other <em>dogs</em>  .   '

    //   expect(highlightQueryInDocs('dog', [doc], options)).toEqual([docExpected])
      
    // })
  })
});

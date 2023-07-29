const { createIndex, indexDocument, searchIndex } = require('../dist')
const porterStemmer = require('porter-stemmer')
const { eng } = require('stopword')

; (async () => {
  // define a (custom) tokenizer for splitting a sentence into tokens
  const tokenizer = (sentence) => sentence.split(' ').map(s => s.trim())

  // define a (custom) anaylzer for preprocessing individual tokens/words
  const REGEXP_PATTERN_PUNCT = new RegExp("['!\"“”#$%&\\'()\*+,\-\.\/:;<=>?@\[\\\]\^_`{|}~']", 'g')
  const analyzer = (token) => {
    let newToken = token.trim().replace(REGEXP_PATTERN_PUNCT, '').toLowerCase()

    if (eng.includes(newToken)) {
      return ''
    }

    return porterStemmer.stemmer(newToken)
  }

  // create a new index with a specific mapping
  const index = createIndex({
    title: 'text',
    body: 'text',
    topic: 'keyword'
  })

  // index some documents
  // raw documents are not stored in the index by default to optimize the index size
  // that's why we keep the data in a lookup mapping that can be used by the search to
  // get the documents later
  const docsLookup = {
    doc1: { title: 'Milk', body: 'A man is drinking milk.', topic: 'a' },
    doc2: { title: 'Bread', body: 'A man is eating breads.', topic: 'a' },
    doc3: { title: 'Butter', body: 'A man is eating bread and butter.', topic: 'b' }
  }
  const docsArray = Object.entries(docsLookup).map(([docId, doc]) => ({ _id: docId, ...doc }))

  docsArray.forEach((doc) => indexDocument(index, doc, analyzer))

  // make an example search on the 'body' and 'title' fields
  console.log(
    await searchIndex(
      index,
      'bread', {
        size: 10,
        queryFields: ['body', 'title'],
        filter: {
          topic: 'a'
        },
        getDocument: docId => docsLookup[docId]
      },
      analyzer,
      tokenizer
    )
  )
  // returns:
  // {
  //   total: 1,
  //   maxScore: 0.08530260953900706,
  //   hits: [ { _id: 'doc2', _score: 0.08530260953900706, _source: [Object] } ]
  // }
})()

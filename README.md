# picosearch

**Warning:** As long as the version is in the 0.X.X range; **version changes are most likely breaking**!

Minimalistic, customizable module for creating basic full-text search indices and queries using the BM25F algorithm (used by Lucene, Elasticsearch etc.). The focus is on providing a simple and reusable implementation and configuration with no dependencies.

- Stemmers and stopwords are **not** included and must be provided as config values.
- JSON serializable indices
- Highly customizable

## Installation

```bash
yarn add picosearch
```

or

```bash
npm install picosearch
```

## Quickstart

```javascript
const { createIndex, indexDocument, searchIndex } = require('picosearch')
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
```


See [examples/](https://github.com/olastor/picosearch/tree/main/examples).

## API

### `createIndex(mappings)`

[TS Doc](https://olastor.github.io/picosearch/functions/createIndex.html)

**Parameters**

- `mappings: Mappings` An object defining the fields of a document. Possible field types: `text`, `keyword`, `number`, `date`.

**Return Value**

Returns an index object to be used for querying and scoring. The raw documents are **not included**. Depending on the size of the text corpus, the size of the index can very.

### `indexDocument(index, document, analyzer, tokenizer)`

[TS Doc](https://olastor.github.io/picosearch/functions/indexDocument.html)

**Parameters**

- `index` The index.
- `document` The document to index.
- `analyzer` A function for analyzing an individual token.
- `tokenizer` A function for splitting a query into individual tokens.

### `searchIndex(index, query, options, analyzer, tokenizer)`

[TS Doc](https://olastor.github.io/picosearch/functions/searchIndex.html)

**Parameters**

- `index` The index.
- `query` The search query.
- `options` The searhc options. See [here](https://olastor.github.io/picosearch/interfaces/QueryOptions.html).
- `analyzer` A function for analyzing an individual token.
- `tokenizer` A function for splitting a query into individual tokens.

**Return Value**

A search results object. See [here](https://olastor.github.io/picosearch/interfaces/SearchResults.html)

## API Docs

see [https://olastor.github.io/picosearch/](https://olastor.github.io/picosearch/) for more details.



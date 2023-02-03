# tiny-search

Tiny, customizable module for creating basic full-text search indices and queries using the [BM25](https://en.wikipedia.org/wiki/Okapi_BM25) algorithm (used by Lucene, Elasticsearch etc.). The focus is on providing a simple and reusable implementation and configuration with no dependencies.

- Stemmers and stopwords are **not** included and must be provided as config values.
- JSON serializable indices
- Only two functions: `buildSearchIndex()` and `querySearchIndex()`
- Highly customizable

## Installation

```bash
yarn add tiny-search
```

or 

```bash
npm install tiny-search
```

## Quickstart

The following shows a basic example of how to create a new search index using an array of sentences and query it. For stemming, the porter stemmer and english stopwords are installed from existing packages, and provided to the options object.

```javascript
const { buildSearchIndex, querySearchIndex } = require('tiny-search')
const porterStemmer = require('porter-stemmer')
const { eng } = require('stopword')

sentences = [
  'A man is eating food.',
  'A man is buying bread.',
  'The woman is riding a bike.',
  'A woman is playing a violin.',
  'Two men are biking.',
  'Two women are biking.',
]

const searchOptions = {
  stemmer: porterStemmer.stemmer,
  lowercase: true,
  stripPunctuation: true,
  stopwords: eng
}

const searchQuery = 'who bought breads?'
console.log(`Searching for "${searchQuery}"`)

const searchIndex = buildSearchIndex(sentences, searchOptions)
const searchResults = querySearchIndex(searchQuery, searchIndex, searchOptions)
// => [ { docId: 1, score: 1.5404450409471488 } ]

console.log(searchResults.map(({ docId, score }) => [sentences[docId], score]))
// => [ [ 'A man is buying bread.', 1.5404450409471488 ] ]
```


See [examples/](https://github.com/olastor/tiny-search/tree/main/examples).

## API

### `buildSearchIndex(docs, options)`

- `docs: string[]`
- `options: SearchOptions`
- returns 

### `querySearchIndex(query, index, options, size)`

- `query: string`
- `index: string`
- `options: SearchOptions`
- `size: number`
- returns

```javascript
const DEFAULT_SEARCH_OPTIONS = {
  tokenizer: (s: string): string[] => s.split(/\s+/g),
  stemmer: null,
  customTransformation: null,
  lowercase: true,
  stripPunctuation: true,
  stopwords: [],
  bm25: {
    k1: 1.2,
    b: 0.75
  }
}
```

# picosearch

Minimalistic, customizable module for creating basic full-text search indices and queries using the [BM25](https://en.wikipedia.org/wiki/Okapi_BM25) algorithm (used by Lucene, Elasticsearch etc.). The focus is on providing a simple and reusable implementation and configuration with no dependencies.

- Stemmers and stopwords are **not** included and must be provided as config values.
- JSON serializable indices
- Only two functions: `buildSearchIndex()` and `querySearchIndex()`
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

The following shows a basic example of how to create a new search index using an array of sentences and query it. For stemming, the porter stemmer and english stopwords are installed from existing packages, and provided to the options object.

```javascript
const { buildSearchIndex, querySearchIndex } = require('picosearch')
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


See [examples/](https://github.com/olastor/picosearch/tree/main/examples).

## API

### `buildSearchIndex(docs, options)`

**Parameters**

- `docs: string[]` An array of documents / texts.
- `options`
  - `tokenizer: (s: string) => string[]` A function to split a text into an array of tokens. Default: `(s: string): string[] => s.split(/\s+/g)`
  - `stemmer: (s: string) => string` A function for applying stemming on each token. Default: `null`
  - `lowercase: boolean` Whether or not to lowercase tokens as part of preprocessing. Default: `true`
  - `stripPunctuation` Whether or not to strip punctuations from tokens. Default: `true`
  - `stopwords` An array of lowercased words that should be ignored. Default: `[]`
  - `customTransformation` A function to apply a custom transformation on each token before every other preprocessing step. Default: `null`
  - `bm25` Object for specifying custom BM25 parameters
    - `b` The `b` value. Default: `1.2`
    - `k1` The `k1` value. Default: `0.75`

**Return Value**

Returns an object containing data structures to be used for querying and scoring. The raw documents are **not included** and the provided `docs` array must be present without modificaton at query time. Depending on the size of the text corpus, the size of the index can very.

### `querySearchIndex(query, index, options, size)`

**Parameters**

- `query: string` The search query.
- `index: object` The index built by the `buildSearchIndex()` function
- `options` The **exactly same** options as provided to the `buildSearchIndex()` function
- `size: number` The maximum amount of result items to return. Default: `10`

**Return Value**

Returns an array of matches sorted by scores descending (starting with the most relevant item), each having these fields:

- `docId`: The ID of the document, i.e., the index of the text in the `docs` array.
- `score`: The calculated BM25 relevancy score.



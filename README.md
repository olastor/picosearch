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

## API Docs

see [https://olastor.github.io/picosearch/](https://olastor.github.io/picosearch/)



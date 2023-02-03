# tiny-search

Tiny, customizable module for creating basic full-text search indices and queries using the [BM25](https://en.wikipedia.org/wiki/Okapi_BM25) algorithm. The focus is on providing a simple and reusable implementation and configuration with no dependencies.

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

## Configuration Options

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

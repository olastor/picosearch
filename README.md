# picosearch

**Warning:** As long as the version is in the 0.X.X range; **version changes are most likely breaking**!

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


## API Docs

see [https://olastor.github.io/picosearch/](https://olastor.github.io/picosearch/)



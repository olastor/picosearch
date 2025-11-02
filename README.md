# picosearch

Minimalistic full-text search implemented in Typescript.

📝 See the [spec](https://github.com/olastor/picosearch/blob/main/SPEC.md) for more details.

**Features:**

- [x] Search across multiple fields (using BM25F) with optional text highlighting
- [x] Fast autocomplete via prefix or fuzzy matching 
- [x] Native language analyzers included for English, German and support for custom analyzers
- [x] Native support for local-first applications via persistent storage drivers and syncing via HTTPs (see [spec](https://github.com/olastor/picosearch/blob/main/SPEC.md#syncing))
- [x] Patch API to efficiently update the search index with offline-generated updates
- [x] Extendable for custom language analyzers and tokenizers
- [x] JSON serializable index

**Not yet implemented:**

- [ ] Snippets
- [ ] Patch updates for modifying or deleting documents

## Installation

```bash
yarn add @picosearch/picosearch
```

## Quick Start

Basic usage is straightforward. First initialize a new instance and index some documents:

```typescript
import { Picosearch } from '@picosearch/picosearch';

type MyDoc = {
  id: string;
  text: string;
  additionalText: string;
};

const documents: MyDoc[] = [
  { id: '1', text: 'The quick brown fox', additionalText: 'A speedy canine' },
  { id: '2', text: 'Jumps over the lazy dog', additionalText: 'High leap' },
  { id: '3', text: 'Bright blue sky', additionalText: 'Clear and sunny day' },
];

const pico = new Picosearch<MyDoc>({ language: 'english' });
pico.insertMultipleDocuments(documents);
```

Please note that currently, a document must be flat, can only contain string values, and needs an `id` field (also a string)!

After indexing, you can now use `searchDocuments()` or `autocomplete()`. For example:

```typescript
pico.searchDocuments('fox').then(console.log)
//[
//  {
//    id: '1',
//    score: 0.5430196556466306,
//    doc: {
//      id: '1',
//      text: 'The quick brown fox',
//      additionalText: 'A speedy canine'
//    }
//  }
//]
```

## Advanced

### Fetching documents on-demand

By default, the documents are included in the search index, which makes it pretty big. Picosearch provides the option to exclude them from the index via `keepDocuments: false` and two options to instead fetch documents only when needed at query time.

**Option 1: Fetch documents via URL**

```typescript
const pico = new Picosearch<MyDoc>({ 
  language: 'english',
  keepDocuments: false,
  fetchDocumentUrl: 'https://my-files/docs/{id}.json'
});
```

Make sure that the URL contains `{id}` as a placeholder.

**Option 2: Custom handler**

```typescript
const pico = new Picosearch<MyDoc>({ 
  language: 'english',
  keepDocuments: false,
  getDocumentById: async (id: string) => { ... }
});
```

### Persistent Storage

You can persist your search index to a local storage. Native storage drivers supported for the browser are: `localstorage` and `indexeddb`.

```typescript
const pico = new Picosearch({ language: 'english', storageDriver: 'localstorage' });
pico.insertMultipleDocuments(documents);
await pico.persist()
```

Checkout the docs for how to specify extra options for these. You can also create a custom storage driver by implementing the `IStorageDriver` interface, then pass it to the class intialization like this:

```typescript
const pico = new Picosearch({ language: 'english', storageDriver: { type: 'custom', driver: MyCustomDriver } });
pico.insertMultipleDocuments(documents);
await pico.persist()
```

To load an existing index from storage, simply call `.sync()`:

```typescript
const pico = new Picosearch({ language: 'english', storageDriver: 'localstorage' });
await pico.sync()
```

### Syncing

Picosearch allows for simple syncing of pre-built indexes via HTTPs. You can specify an URL for the index, and an URL pattern for patches. Checkout the [spec](https://github.com/olastor/picosearch/blob/main/SPEC.md#syncing) to learn how it works under the hood.

```typescript
const indexUrl = 'https://example.com/index.json';
const patchUrl = 'https://example.com/patches/v{version}.json';

const searchIndex = new Picosearch({
  indexUrl,
  patchUrl
});
await searchIndex.sync()
```

Call `.sync()` subsequently to check if new updates are available in the remote storage. You can create patches by adding new documents to the latest index via `.createPatch()`, then updload them with the correct version to your file server.

Note that you can combine syncing and persisting, `.sync()` already takes care of that if a storage is configured.

**Example:**

![Example Deployment](./docs/images/example-deployment.png)

### Custom Language Preprocessing

You can also provide a custom tokenizer (for splitting a document into words/tokens) and analyzer (processing a single token before indexing it). Just implement the types `Tokenizer` and `Analyzer` and provide these implementations to the constructor. Example:

```typescript
import {
  Picosearch,
  type Analyzer,
  type Tokenizer,
} from '@picosearch/picosearch';

const myTokenizer: Tokenizer = (doc: string): string[] => doc.split(' ');

const myAnalyzer: Analyzer = (token: string): string =>
  // when the analyzer returns '', it is removed
  ['and', 'I'].includes(token) ? '' : token.toLowerCase();

const pico = new Picosearch({
  tokenizer: myTokenizer,
  analyzer: myAnalyzer,
});
```

### JSON Serialization

Indexes can be exported to and imported from JSON. This is useful, for example, for performing the more compute-heavy indexing offline when the search runtime is in the browser. It is very important that if you have any functions as part of the constructor (e.g., `getDocumentById`, `analyzer`, `tokenzier`), you **pass the same functions** again and don't change any other constructor options. Here's an example:

```typescript
import { Picosearch } from '@picosearch/picosearch';
const getDocById = async (id: string) => ...
const pico = new Picosearch<Doc>({ getDocumentById: getDocById, keepDocuments: true });
// ...index documents

const jsonIndex = pico.toJSON() 

// non-function options like `keepDocuments` are preserved in the JSON index
const fromSerialized = new Picosearch<Doc>({ getDocumentById: getDocById, jsonIndex });
```

## Benchmark

The CI/CD pipeline includes a benchmarking step to ensure there are no performance regressions. It currently validates against three datasets of the BEIR benchmark. The performance is checked to be the same or slightly higher (due to multi-field matching) compared to the BM25 baseline.

|                                     | scidocs | nfcorpus | scifact |
|-------------------------------------|---------|----------|---------|
| Picosearch+English (BM25F)          | 15.6%   | 32.9%    | 69.0%   |
| Baseline (BM25) [1]                 | 15.8%   | 32.5%    | 66.5%   |

[1] Thakur, N., Reimers, N., Rücklé, A., Srivastava, A., & Gurevych, I. (2021). BEIR: A heterogeneous benchmark for zero-shot evaluation of information retrieval models. Ubiquitous Knowledge Processing Lab (UKP-TUDA), Department of Computer Science, Technische Universität Darmstadt. Retrieved from https://arxiv.org/pdf/2104.08663

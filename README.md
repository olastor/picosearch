# picosearch

Minimalistic, customizable module for creating basic full-text search indices and queries using the BM25F algorithm (used by Lucene, Elasticsearch etc.). The focus is on providing a simple and reusable implementation and configuration with no dependencies.

- Fully typed with TypeScript for robust development
- Benchmark tests in CI/CD to ensure optimal search performance
- JSON-serializable indexes for seamless export and import

## Installation

```bash
yarn add @picosearch/picosearch
```

## Quick Start

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

const pico = new Picosearch<Doc>();
pico.insertMultipleDocuments(documents);
console.log(pico.searchDocuments('jump sun'));
```

## Language-specific Preprocessing

By default, only a generic preprocessing is being done (simple regex tokenizer + lowercasing). It is **highly recommended** to replace this with language-specific options. Currently, the following languages have an additional package for pre-processing:

- English (`@picosearch/language-english`)
- German (`@picosearch/language-german`)

After installing it, use it like this:

```typescript
import { Picosearch } from '@picosearch/picosearch';
import * as englishOptions from '@picosearch/language-english';
const pico = new Picosearch<Doc>({ ...englishOptions });
```

Create an issue if you need another language!

## Custom Preprocessing

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

## JSON Serialization

Indexes can be exported to and imported from JSON-serializable objects. This is useful, for example, for performing the more compute-heavy indexing offline when the search runtime is in the browser. It is very important that you **pass the same tokenizer and analyzer in the new instance** and don't change any other constructor options. Here's an example:

```
import { Picosearch } from '@picosearch/picosearch';
import * as englishOptions from '@picosearch/language-english';
const pico = new Picosearch<Doc>({ ...englishOptions });
// ...index documents

const jsonIndex = pico.toJSON() 

const fromSerialized = new Picosearch<Doc>({ ...englishOptions, jsonIndex });
```


## Benchmark

The CI/CD pipeline includes a benchmarking step to ensure there are no performance regressions. It currently validates against three datasets of the BEIR benchmark. The performance is checked to be the same or slightly higher (due to multi-field matching) compared to the BM25 baseline.

|                                     | scidocs | nfcorpus | scifact |
|-------------------------------------|---------|----------|---------|
| Picosearch+English (BM25F)          | 15.6%   | 32.9%    | 69.0%   |
| Baseline (BM25) [1]                 | 15.8%   | 32.5%    | 66.5%   |

[1] Thakur, N., Reimers, N., Rücklé, A., Srivastava, A., & Gurevych, I. (2021). BEIR: A heterogeneous benchmark for zero-shot evaluation of information retrieval models. Ubiquitous Knowledge Processing Lab (UKP-TUDA), Department of Computer Science, Technische Universität Darmstadt. Retrieved from https://arxiv.org/pdf/2104.08663

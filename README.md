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

const pico = new Picosearch<Doc>({ ...englishOptions });
pico.insertMultipleDocuments(documents);
console.log(pico.searchDocuments('jump sun'));
```

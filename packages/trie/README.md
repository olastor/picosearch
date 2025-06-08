# Trie

This package implements a simple Trie(-Map) data structure.

## Installation

```bash
pnpm add @picosearch/trie
```

## Usage

### TrieMap

When using `TrieMap` you can pass one or more values for a key.

```ts
import { TrieMap } from '@picosearch/trie';

const trieMap = new TrieMap<number>();
trieMap.insert('abc', 1);
trieMap.insert('abd', 2);

console.log(trieMap.lookup('abc')); // [1]
console.log(trieMap.lookup('ae')); // null
```

### Trie

When using `Trie` you cannot pass values for a key. Instead of `lookup` you can use `has` to check if a key exists.

```ts
import { Trie } from '@picosearch/trie';

const trie = new Trie();
trie.insert('abc');
trie.insert('abd');

console.log(trie.has('abc')); // true
console.log(trie.has('ae')); // false
```

### toJSON + fromJSON

```ts
import { Trie } from '@picosearch/trie';

const trie = new Trie();
trie.insert('abc');
trie.insert('abd');

const jsonStr = trie.toJSON();
const newTrie = Trie.fromJSON(jsonStr);

console.log(newTrie.has('abc')); // true
console.log(newTrie.has('ae')); // false
```

### getFuzzyMatches

```ts
import { Trie } from '@picosearch/trie';

const trie = new Trie();
trie.insert('abc');
trie.insert('abd');

console.log(trie.getFuzzyMatches('ab', { maxErrors: 1 })); // ['abc', 'abd']
```

Please note that a Trie is not optimized for fuzzy search and this function implements a dynamic programming approach to compute the edit distance for each path in the Trie. This approach is faster than a naive implementation, but for larger data sets you should consider using other data structures like a BK-Tree.
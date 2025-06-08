## RadixTree

This package implements a RadixTree(-Map) data structure.

## Installation

```bash
pnpm add @picosearch/radix-tree
```

## Usage

### RadixTreeMap

When using `RadixTreeMap` you can pass one or more values for a key.

```ts
import { RadixTreeMap } from '@picosearch/radix-tree';

const radixTreeMap = new RadixTreeMap<number>();
radixTreeMap.insert('abc', 1);
radixTreeMap.insert('abd', 2);

console.log(radixTreeMap.lookup('abc')); // [1]
console.log(radixTreeMap.lookup('ae')); // null
```

### RadixTree

When using `RadixTree` you cannot pass values for a key. Instead of `lookup` you can use `has` to check if a key exists.

```ts
import { RadixTree } from '@picosearch/radix-tree';

const radixTree = new RadixTree();
radixTree.insert('abc');
radixTree.insert('abd');

console.log(radixTree.has('abc')); // true
console.log(radixTree.has('ae')); // false
```

### toJSON + fromJSON

```ts
import { RadixTree } from '@picosearch/radix-tree';

const radixTree = new RadixTree();
radixTree.insert('abc');
radixTree.insert('abd');

const jsonStr = radixTree.toJSON();
const newRadixTree = RadixTree.fromJSON(jsonStr);

console.log(newRadixTree.has('abc')); // true
console.log(newRadixTree.has('ae')); // false
```

### getFuzzyMatches

```ts
import { RadixTree } from '@picosearch/radix-tree';

const radixTree = new RadixTree();
radixTree.insert('abc');
radixTree.insert('abd');

console.log(radixTree.getFuzzyMatches('ab', { maxErrors: 1 })); // ['abc', 'abd']
```

Please note that a RadixTree is not optimized for fuzzy search and this function implements a dynamic programming approach to compute the edit distance for each path in the RadixTree. This approach is faster than a naive implementation, but for larger data sets you should consider using other data structures like a BK-Tree.

# BK-Tree

This package implements a simple BK-Tree data structure. A BK-Tree is a data structure for fuzzy string matching using a distance function like Levenshtein distance.

## Installation

```bash
pnpm add @picosearch/bk-tree
```

## Usage

### BKTree

Use `lookup` to find the closest word to the query and `find` to find all words within a given distance.

```ts
import { BKTree } from '@picosearch/bk-tree';

const bkTree = new BKTree();
bkTree.insert('abc');
bkTree.insert('abd');

console.log(bkTree.find('ab', { maxError: 1 })); // ['abc', 'abd']
console.log(bkTree.lookup('ab')); // 'abc'
```

### toJSON + fromJSON

You can serialize the BK-Tree to a JSON string and deserialize it back to a BK-Tree.

```ts
import { BKTree } from '@picosearch/bk-tree';

const bkTree = new BKTree();
bkTree.insert('abc');
bkTree.insert('abd');

const jsonStr = bkTree.toJSON();
const newBKTree = BKTree.fromJSON(jsonStr);

console.log(newBKTree.find('ab', { maxError: 1 })); // ['abc', 'abd']
```

### Custom Distance Function

You can provide a custom distance function to the constructor. The distance function must satisfy the triangle inequality property. 

```ts
import { BKTree } from '@picosearch/bk-tree';
import type { DistanceFunction } from '@picosearch/bk-tree';

const customDistanceFunction: DistanceFunction = (a, b): number => {
  // custom distance function
  return 0;
};

const bkTree = new BKTree({
  getDistance: customDistanceFunction,
});
```



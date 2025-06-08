import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { NODE_KEYS } from './constants';
import type { RadixBKTreeMapNode } from './types';
import {
  assert,
  addBKChild,
  addRadixChild,
  addValues,
  fromMinifiedNode,
  getBKChild,
  getCommonPrefix,
  getNodeWord,
  sortedInsert,
  toMinifiedNode,
} from './util';

describe('sortedInsert', () => {
  it('should insert a value into an empty array', () => {
    const array: number[] = [];
    sortedInsert(array, 1, (a, b) => a - b);
    expect(array).toEqual([1]);
  });

  it('should insert a value at the beginning of the array', () => {
    const array = [2, 3, 4, 5];
    sortedInsert(array, 1, (a, b) => a - b);
    expect(array).toEqual([1, 2, 3, 4, 5]);
  });

  it('should insert a value in the middle of the array', () => {
    const array = [1, 2, 4, 5];
    sortedInsert(array, 3, (a, b) => a - b);
    expect(array).toEqual([1, 2, 3, 4, 5]);
  });

  it('should insert a value at the end of the array', () => {
    const array = [1, 2, 3, 4];
    sortedInsert(array, 5, (a, b) => a - b);
    expect(array).toEqual([1, 2, 3, 4, 5]);
  });

  it('should handle inserting a duplicate value', () => {
    const array = [1, 2, 3, 4, 5];
    sortedInsert(array, 3, (a, b) => a - b);
    expect(array).toEqual([1, 2, 3, 3, 4, 5]);
  });

  it('should work with a custom comparator', () => {
    const array = [5, 4, 3, 2, 1]; // Sorted in descending order
    const comparator = (a: number, b: number) => b - a; // Sort in descending order
    sortedInsert(array, 3, comparator);
    expect(array).toEqual([5, 4, 3, 3, 2, 1]);
  });

  it('should work with objects and a custom comparator', () => {
    const array = [
      { id: 1, name: 'Alice' },
      { id: 3, name: 'Charlie' },
      { id: 5, name: 'Eve' },
    ];
    const newItem = { id: 4, name: 'David' };
    const comparator = (a: { id: number }, b: { id: number }) => a.id - b.id;

    sortedInsert(array, newItem, comparator);

    expect(array).toEqual([
      { id: 1, name: 'Alice' },
      { id: 3, name: 'Charlie' },
      { id: 4, name: 'David' },
      { id: 5, name: 'Eve' },
    ]);
  });

  test.prop([
    fc.array(fc.integer(), { minLength: 0, maxLength: 50 }), // Initial array
    fc.array(fc.integer(), { minLength: 1, maxLength: 20 }), // Values to insert
  ])(
    'should maintain sorted order when inserting multiple values',
    (array, valuesToInsert) => {
      // Sort the input array first
      const sortedArray = [...array].sort((a, b) => a - b);

      // Start with the initial sorted array
      const result = [...sortedArray];

      // Insert each value one by one
      for (const value of valuesToInsert) {
        sortedInsert(result, value, (a, b) => a - b);

        // Verify the array remains sorted after each insertion
        for (let i = 1; i < result.length; i++) {
          expect(result[i - 1]).toBeLessThanOrEqual(result[i]);
        }
      }

      // Verify all original elements and inserted values are present
      const expectedElements = [...new Set([...array, ...valuesToInsert])];
      const resultElements = [...new Set(result)];
      expect(resultElements).toHaveLength(expectedElements.length);
      expect(resultElements).toEqual(expect.arrayContaining(expectedElements));
    },
  );
});

describe('getBKChild', () => {
  it('should return undefined for non-existent key', () => {
    const node = {
      [NODE_KEYS.BK_CHILDREN]: { 1: { value: 'test' } },
    } as unknown as RadixBKTreeMapNode<string>;
    expect(getBKChild(node, 2)).toBeUndefined();
  });

  it('should return the child node for existing key', () => {
    const childNode = { value: 'test' };
    const node = {
      [NODE_KEYS.BK_CHILDREN]: { 1: childNode },
    } as unknown as RadixBKTreeMapNode<string>;
    expect(getBKChild(node, 1)).toBe(childNode);
  });

  it('should return undefined when BK_CHILDREN is undefined', () => {
    const node = {} as RadixBKTreeMapNode<string>;
    expect(getBKChild(node, 1)).toBeUndefined();
  });
});

describe('addRadixChild', () => {
  it('should add a radix child to the parent node', () => {
    const parent = {} as RadixBKTreeMapNode<string>;
    const child = { [NODE_KEYS.IS_ROOT]: false } as RadixBKTreeMapNode<string>;

    addRadixChild(parent, 'test', child);

    expect(parent[NODE_KEYS.RADIX_CHILDREN]).toHaveLength(1);
    expect(parent[NODE_KEYS.RADIX_CHILDREN]?.[0][1]).toBe('test');
    expect(parent[NODE_KEYS.RADIX_CHILDREN]?.[0][2]).toBe(child);
    expect(child[NODE_KEYS.PARENT]).toBe(parent[NODE_KEYS.RADIX_CHILDREN]?.[0]);
  });

  it('should not set parent for root nodes', () => {
    const parent = {} as RadixBKTreeMapNode<string>;
    const child = { [NODE_KEYS.IS_ROOT]: true } as RadixBKTreeMapNode<string>;

    addRadixChild(parent, 'test', child);

    expect(child[NODE_KEYS.PARENT]).toBeUndefined();
  });
});

describe('addBKChild', () => {
  it('should add a BK child to the parent node', () => {
    const parent = {} as RadixBKTreeMapNode<string>;
    const child = {} as RadixBKTreeMapNode<string>;

    addBKChild(parent, 1, child);

    expect(parent.k).toBeDefined();
    expect(parent.k?.[1]).toBe(child);
  });

  it('should not overwrite existing BK children', () => {
    const existingChild = {} as RadixBKTreeMapNode<string>;
    const parent = {
      k: { 2: existingChild },
    } as unknown as RadixBKTreeMapNode<string>;
    const newChild = {} as RadixBKTreeMapNode<string>;

    addBKChild(parent, 1, newChild);

    expect(parent.k?.[1]).toBe(newChild);
    expect(parent.k?.[2]).toBe(existingChild);
  });
});

describe('getNodeWord', () => {
  it('should return the full word by traversing up the tree', () => {
    const grandparent = {} as RadixBKTreeMapNode<string>;
    const parentEdge = [grandparent, 'par', undefined] as const;
    const parent = {
      [NODE_KEYS.PARENT]: parentEdge,
    } as RadixBKTreeMapNode<string>;
    const childEdge = [parent, 'ent', undefined] as const;
    const child = {
      [NODE_KEYS.PARENT]: childEdge,
    } as RadixBKTreeMapNode<string>;

    // Fix the edge references
    (parentEdge as any)[2] = parent;
    (childEdge as any)[2] = child;

    expect(getNodeWord(child)).toBe('parent');
  });

  it('should return empty string for root node', () => {
    const root = { [NODE_KEYS.IS_ROOT]: true } as RadixBKTreeMapNode<string>;
    expect(getNodeWord(root)).toBe('');
  });
});

describe('addValues', () => {
  it('should add values to the node', () => {
    const node = { v: ['existing'] } as RadixBKTreeMapNode<string>;
    addValues(node, ['new1', 'new2']);
    expect(node.v).toEqual(['existing', 'new1', 'new2']);
  });

  it('should initialize values array if not present', () => {
    const node = {} as RadixBKTreeMapNode<string>;
    addValues(node, ['new']);
    expect(node.v).toEqual(['new']);
  });

  it('should do nothing if values array is empty', () => {
    const node = {} as RadixBKTreeMapNode<string>;
    addValues(node, []);
    expect(node.v).toBeUndefined();
  });

  it('should do nothing if values is undefined', () => {
    const node = {} as RadixBKTreeMapNode<string>;
    addValues(node, undefined as unknown as string[]);
    expect(node.v).toBeUndefined();
  });
});

describe('getCommonPrefix', () => {
  it('should return empty string for no common prefix', () => {
    expect(getCommonPrefix('abc', 'def')).toBe('');
  });

  it('should return full string for equal strings', () => {
    expect(getCommonPrefix('abc', 'abc')).toBe('abc');
  });

  it('should return common prefix', () => {
    expect(getCommonPrefix('hello world', 'hello there')).toBe('hello ');
  });

  it('should handle empty strings', () => {
    expect(getCommonPrefix('', 'abc')).toBe('');
    expect(getCommonPrefix('abc', '')).toBe('');
    expect(getCommonPrefix('', '')).toBe('');
  });
});

describe('toMinifiedNode / fromMinifiedNode', () => {
  it('should serialize and deserialize a simple tree with only radix children', () => {
    const leaf = { v: ['a'] } as any;
    const root = { r: [[null, 'x', leaf]] } as any;
    const arr = toMinifiedNode(root);
    expect(Array.isArray(arr)).toBe(true);
    const restored = fromMinifiedNode(arr);
    expect(restored.r?.[0][2].v).toEqual(['a']);
  });

  it('should preserve shared subtrees (no duplicate nodes)', () => {
    // node2 is both a radix and a BK child of root
    const node2 = { v: ['shared'] } as any;
    const root = { r: [[null, 'a', node2]], k: { 1: node2 } } as any;
    const arr = toMinifiedNode(root);
    const restored = fromMinifiedNode(arr);
    // The same object instance should be referenced from both places
    const radixChild = restored.r?.[0][2];
    const bkChild = restored.k?.[1];
    expect(radixChild).toBe(bkChild);
    expect(radixChild.v).toEqual(['shared']);
  });

  it('should handle trees with both radix and BK children and values', () => {
    const leaf1 = { v: ['v1'] } as any;
    const leaf2 = { v: ['v2'] } as any;
    const root = { r: [[null, 'x', leaf1]], k: { 3: leaf2 } } as any;
    const arr = toMinifiedNode(root);
    const restored = fromMinifiedNode(arr);
    expect(restored.r?.[0][2].v).toEqual(['v1']);
    expect(restored.k?.[3].v).toEqual(['v2']);
  });

  it('should be JSON serializable and parseable', () => {
    const node = { v: [1] } as any;
    node.k = { 1: node }; // self-loop (should not be possible in real BK-tree, but test for robustness)
    const arr = toMinifiedNode(node);
    const json = JSON.stringify(arr);
    const parsed = JSON.parse(json);
    const restored = fromMinifiedNode(parsed);
    expect(restored.v).toEqual([1]);
    expect(restored.k?.[1]).toBe(restored); // self-loop restored
  });
});

describe('assert', () => {
  it('should not throw when condition is truthy', () => {
    expect(() => assert(true, 'error')).not.toThrow();
  });

  it('should throw when condition is falsy', () => {
    expect(() => assert(false, 'error message')).toThrow('error message');
  });
});

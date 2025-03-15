import { describe, expect, it } from 'vitest';
import { Trie } from './trie';

describe('Trie', () => {
  it('should insert and search sequences correctly', () => {
    const trie = new Trie<number>();
    trie.insert(['a', 'b', 'c'], [1]);
    trie.insert(['a', 'b', 'd'], [2]);

    expect(trie.search(['a', 'b', 'c'])).toEqual([1]);
    expect(trie.search(['a', 'b', 'd'])).toEqual([2]);
    expect(trie.search(['a', 'b'])).toEqual([]);
    expect(trie.search(['a', 'e'])).toEqual([]);
  });

  it('should return an empty array for empty sequences', () => {
    const trie = new Trie<number>();
    expect(trie.search([])).toEqual([]);
  });

  it('should convert to and from JSON', () => {
    const trie = new Trie<number>();
    trie.insert(['x', 'y', 'z'], [3]);

    const jsonStr = trie.toJSON();
    const newTrie = Trie.fromJSON<number>(jsonStr);

    expect(newTrie.search(['x', 'y', 'z'])).toEqual([3]);
  });
});

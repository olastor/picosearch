import { trieInsert, trieSearch } from '../src/utils/trie'
import { test, fc } from '@fast-check/jest';
import { TrieNode } from '../src/interfaces'

// fc.configureGlobal({ verbose: true, numRuns: 5000, endOnFailure: true });

describe('Trie', () => {
  test('should insert and find strings', () => {
    const trie: TrieNode<number> = {
      _c: {},
      _d: []
    }

    trieInsert<number>(trie, 0, 'car'.split(''))
    trieInsert<number>(trie, 1, 'carwheel'.split(''))
    trieInsert<number>(trie, 2, 'cat'.split(''))
    trieInsert<number>(trie, 3, 'zebra'.split(''))
    trieInsert<number>(trie, 4, 'zebra'.split(''))

    expect((trieSearch<number>(trie, 'car'.split('')) as TrieNode<number>)._d).toEqual([0])
    expect((trieSearch(trie, 'carwheel'.split('')) as TrieNode<number>)._d).toEqual([1])
    expect((trieSearch(trie, 'cat'.split('')) as TrieNode<number>)._d).toEqual([2])
    expect((trieSearch(trie, 'zebra'.split('')) as TrieNode<number>)._d).toEqual([3, 4])

    const missingValues = ['c', 'ca', 'asd', 'zeb', 'zebraa', 'carwh']
    missingValues.forEach((s: string) => {
      expect(trieSearch(trie, s.split(''))).toEqual(null)
    })
  })

  test('should fuzzy match', () => {
    const trie: TrieNode<number> = {
      _c: {},
      _d: []
    }

    trieInsert<number>(trie, 0, 'car'.split(''))
    trieInsert<number>(trie, 1, 'carwheel'.split(''))
    trieInsert<number>(trie, 3, 'zebra'.split(''))
    trieInsert<number>(trie, 4, 'zebra'.split(''))
  })
})

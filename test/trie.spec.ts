import { trieInsert, trieSearch, trieDelete, trieFuzzySearch } from '../src/utils/trie'
import { test, fc } from '@fast-check/jest';
import { TrieNode } from '../src/interfaces'

// fc.configureGlobal({ verbose: true, numRuns: 5000, endOnFailure: true });

describe('Trie', () => {
  test('should insert and find strings', () => {
    const trie: TrieNode<number> = {
      children: {},
      items: []  
    }

    trieInsert<number>(trie, 0, 'car')
    trieInsert<number>(trie, 1, 'carwheel')
    trieInsert<number>(trie, 2, 'cat')
    trieInsert<number>(trie, 3, 'zebra')
    trieInsert<number>(trie, 4, 'zebra')

    expect((trieSearch<number>(trie, 'car') as TrieNode<number>).items).toEqual([0])
    expect((trieSearch(trie, 'carwheel') as TrieNode<number>).items).toEqual([1])
    expect((trieSearch(trie, 'cat') as TrieNode<number>).items).toEqual([2])
    expect((trieSearch(trie, 'zebra') as TrieNode<number>).items).toEqual([3, 4])

    const missingValues = ['c', 'ca', 'asd', 'zeb', 'zebraa', 'carwh']
    missingValues.forEach((s: string) => {
      expect(trieSearch(trie, s)).toEqual(null)
    })
  })

  test('should fuzzy match', () => {
    const trie: TrieNode<number> = {
      children: {},
      items: []  
    }

    trieInsert<number>(trie, 0, 'car')
    trieInsert<number>(trie, 1, 'carwheel')
    trieInsert<number>(trie, 3, 'zebra')
    trieInsert<number>(trie, 4, 'zebra')

    const fs1 = trieFuzzySearch<number>(trie, 'car', 0)
    expect(fs1.length).toEqual(1)
    expect(fs1[0][1].items).toEqual([0])

    const fs2 = trieFuzzySearch<number>(trie, 'cat', 1)
    expect(fs2.length).toEqual(1)
    expect(fs2[0][1].items).toEqual([0])

    const fs3 = trieFuzzySearch<number>(trie, 'zbra', 1)
    expect(fs3.length).toEqual(1)
    expect(fs3[0][1].items).toEqual([3, 4])

    const fs4 = trieFuzzySearch<number>(trie, 'zra', 1)
    expect(fs4.length).toEqual(0)

    const fs5 = trieFuzzySearch<number>(trie, 'zra', 2)
    expect(fs5.length).toEqual(1)
    expect(fs5[0][1].items).toEqual([3, 4])
  })

  test.prop([
    fc.uniqueArray(fc.string(), { minLength: 1 })
  ])('should return correct leaf with max distance = 0', (arr) => {
    const trie: TrieNode<number> = {
      children: {},
      items: []  
    }
    arr.forEach((s, i) => trieInsert<number>(trie, i, s))
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i]
      const fs = trieFuzzySearch<number>(trie, s, 0)
      if (fs.length !== 1 || !fs[0][1].items.includes(i)) {
        return false
      }
    }

    false
  })

})

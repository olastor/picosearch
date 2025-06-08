import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { Trie, TrieMap } from './trie';

//fc.configureGlobal({ numRuns: 1000 });

// reference implementation copied from https://en.wikibooks.org/wiki/Algorithm_Implementation/Strings/Levenshtein_distance#JavaScript
function getEditDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // increment along the first column of each row
  let i: number;
  for (i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // increment each column in the first row
  let j: number;
  for (j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1,
          ),
        ); // deletion
      }
    }
  }

  return matrix[b.length][a.length];
}

describe('TrieMap', () => {
  describe('insert + lookup', () => {
    it('should insert and lookup sequences correctly', () => {
      const trie = new TrieMap<number>();
      trie.insert('abc', 1);
      trie.insert('abd', 2);

      expect(trie.lookup('abc')).toEqual([1]);
      expect(trie.lookup('abd')).toEqual([2]);
      expect(trie.lookup('ab')).toEqual(null);
      expect(trie.lookup('ae')).toEqual(null);
    });
    it('should return null for empty sequences', () => {
      const trie = new TrieMap<number>();
      expect(trie.lookup('')).toEqual(null);
    });
  });

  describe('toJSON + fromJSON', () => {
    it('should convert to and from JSON', () => {
      const trie = new TrieMap<number>();
      trie.insert('xyz', 3);

      const jsonStr = trie.toJSON();
      const newTrie = TrieMap.fromJSON<number>(jsonStr);

      expect(newTrie.lookup('xyz')).toEqual([3]);
    });
  });

  describe('getFuzzyMatches', () => {
    const testWords = [
      'survey',
      'surveys',
      'surgery',
      'surfing',
      'serve',
      'service',
      'serge',
      'super',
    ];

    const trie = new TrieMap<number>();
    testWords.forEach((word, i) => trie.insert(word, i));

    it('should fuzzy search correctly', () => {
      expect(
        trie.getFuzzyMatches('survey', { maxErrors: 5, includeValues: true }),
      ).toEqual([
        ['survey', [0]],
        ['surveys', [1]],
        ['serve', [4]],
        ['surgery', [2]],
        ['serge', [6]],
        ['super', [7]],
        ['service', [5]],
        ['surfing', [3]],
      ]);
    });

    it('should filter max errors correctly', () => {
      expect(
        trie.getFuzzyMatches('survey', { maxErrors: 2, includeValues: true }),
      ).toEqual([
        ['survey', [0]],
        ['surveys', [1]],
        ['serve', [4]],
        ['surgery', [2]],
      ]);
    });

    test.prop([
      fc.uniqueArray(fc.string({ minLength: 1 })),
      fc.string({ minLength: 1 }),
      fc.nat(),
    ])('should detect the substring', (corpus, query, maxErrors) => {
      const trie = new TrieMap<number>();
      corpus.forEach((word, i) => trie.insert(word, i));

      const expected = corpus
        .map((word, i) => ({
          match: word,
          distance: getEditDistance(word, query),
          values: [i],
        }))
        .sort((a, b) => {
          const diff = a.distance - b.distance;
          return diff === 0 ? a.match.localeCompare(b.match) : diff;
        })
        .filter(({ distance }) => distance <= maxErrors);

      const actual = trie.getFuzzyMatches(query, {
        maxErrors,
        includeValues: true,
      });

      return (
        expected.length === actual.length &&
        actual.every(
          ([match, values], i) =>
            expected[i].match === match &&
            expected[i].values.every((v, j) => values[j] === v),
        )
      );
    });
  });
});

describe('Trie', () => {
  describe('insert + has', () => {
    it('should insert and check for sequences correctly', () => {
      const trie = new Trie();
      trie.insert('abc');
      trie.insert('abd');

      expect(trie.has('abc')).toEqual(true);
      expect(trie.has('abd')).toEqual(true);
      expect(trie.has('ab')).toEqual(false);
      expect(trie.has('ae')).toEqual(false);
    });

    it('should not change when inserting twice', () => {
      const trie = new Trie();
      trie.insert('abc');
      const jsonStr = trie.toJSON();
      trie.insert('abc');
      expect(trie.toJSON()).toEqual(jsonStr);
    });
  });

  describe('toJSON + fromJSON', () => {
    it('should convert to and from JSON', () => {
      const trie = new Trie();
      trie.insert('xyz');

      const jsonStr = trie.toJSON();
      const newTrie = Trie.fromJSON(jsonStr);

      expect(newTrie.has('xyz')).toEqual(true);
    });
  });
});

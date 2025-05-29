import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { Trie } from './trie';

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

  describe('fuzzy search', () => {
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

    const trie = new Trie<number>();
    testWords.forEach((word, i) => trie.insert(word.split(''), [i]));

    it('should fuzzy search correctly', () => {
      expect(trie.fuzzySearch('survey'.split(''), 5)).toEqual([
        { match: 'survey', distance: 0, values: [0] },
        { match: 'surveys', distance: 1, values: [1] },
        { match: 'serve', distance: 2, values: [4] },
        { match: 'surgery', distance: 2, values: [2] },
        { match: 'serge', distance: 3, values: [6] },
        { match: 'super', distance: 3, values: [7] },
        { match: 'service', distance: 4, values: [5] },
        { match: 'surfing', distance: 4, values: [3] },
      ]);
    });

    it('should filter max errors correctly', () => {
      expect(trie.fuzzySearch('survey'.split(''), 2)).toEqual([
        { match: 'survey', distance: 0, values: [0] },
        { match: 'surveys', distance: 1, values: [1] },
        { match: 'serve', distance: 2, values: [4] },
        { match: 'surgery', distance: 2, values: [2] },
      ]);
    });

    test.prop([
      fc.uniqueArray(fc.string({ minLength: 1 })),
      fc.string({ minLength: 1 }),
      fc.nat(),
    ])('should detect the substring', (corpus, query, maxErrors) => {
      const trie = new Trie<number>();
      corpus.forEach((word, i) => trie.insert(word.split(''), [i]));

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

      const actual = trie.fuzzySearch(query.split(''), maxErrors);

      return (
        expected.length === actual.length &&
        actual.every(
          ({ match, distance, values }, i) =>
            expected[i].match === match &&
            expected[i].distance === distance &&
            expected[i].values.every((v, j) => values[j] === v),
        )
      );
    });
  });
});

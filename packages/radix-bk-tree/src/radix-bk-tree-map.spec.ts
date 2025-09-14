import { fc, test } from '@fast-check/vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { NODE_KEYS } from './constants';
import { RadixBKTreeMap } from './radix-bk-tree-map';
import { isEqualTreeStrict, traverseRadix } from './util';

fc.configureGlobal({ numRuns: 100 });

// reference implementation copied from https://en.wikibooks.org/wiki/Algorithm_Implementation/Strings/Levenshtein_distance#JavaScript
function getEditDistanceRef(a: string, b: string): number {
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

describe('RadixBKTreeMap', () => {
  describe('insert', () => {
    it('should insert fuzzy and prefix correctly', () => {
      const radix = new RadixBKTreeMap<number>();
      // no value => cannot be found with lookup, only fuzzy search
      radix.insert('hello');
      // cannot be found with fuzzy search, only prefix search
      radix.insertNoFuzzy('world', 1);
      expect(radix.lookup('hello')).toEqual(null);
      expect(radix.lookup('world')).toEqual([1]);
      expect(radix.getFuzzyMatches('hallo', { includeValues: true })).toEqual([
        ['hello', []],
      ]);
      expect(radix.getFuzzyMatches('world', { includeValues: true })).toEqual(
        [],
      );
      expect(radix.getPrefixMatches('hell', { includeValues: true })).toEqual(
        [],
      );
      expect(radix.getPrefixMatches('wor', { includeValues: true })).toEqual([
        ['world', [1]],
      ]);
    });

    test.prop([fc.uniqueArray(fc.string({ minLength: 1, maxLength: 100 }))])(
      'should never have common prefixes among children',
      (corpus) => {
        const radix = new RadixBKTreeMap<number>();
        corpus.forEach((word) => radix.insert(word, 0));
        let ok = true;
        // @ts-expect-error
        traverseRadix(radix.root, (node) => {
          const firstChars = Object.keys(
            node[NODE_KEYS.RADIX_CHILDREN] || {},
          ).map((k) => k[0]);
          if (firstChars.length !== new Set(firstChars).size) {
            ok = false;
          }
        });
        return ok;
      },
    );
  });

  describe('lookup', () => {
    it('should return an empty array for empty sequences', () => {
      const radix = new RadixBKTreeMap<number>();
      expect(radix.lookup('')).toEqual([]);
    });
    it('should return the correct values', () => {
      const radix = new RadixBKTreeMap<number>();
      radix.insert('toast', 1);
      radix.insert('toaster', 3, 4);
      radix.insert('team', 5);
      radix.insert('bob', 6);
      radix.insert('bobby', 7);
      radix.insert('bobbies', 8);
      radix.insert('toast', 2);

      expect(radix.lookup('toast')).toEqual([1, 2]);
    });
    it('should insert and search sequences correctly', () => {
      const radix = new RadixBKTreeMap<number>();
      radix.insert('toast', 1);
      radix.insert('toaster', 3, 4);
      radix.insert('team', 5);
      radix.insert('bob', 6);
      radix.insert('bobby', 7);
      radix.insert('bobbies', 8);
      radix.insert('toast', 2);

      expect(radix.lookup('toast')).toEqual([1, 2]);
      expect(radix.lookup('toaster')).toEqual([3, 4]);
      expect(radix.lookup('team')).toEqual([5]);
      expect(radix.lookup('bob')).toEqual([6]);
      expect(radix.lookup('bobby')).toEqual([7]);
      expect(radix.lookup('bobbies')).toEqual([8]);
    });
    test.prop([fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 }))])(
      'should insert and lookup any string',
      (corpus) => {
        const radix = new RadixBKTreeMap<number>();
        corpus.forEach((word, i) => radix.insert(word, i));
        return corpus.every((word, i) => {
          const found = radix.lookup(word);
          return found?.length === 1 && found[0] === i;
        });
      },
    );
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
    const expected = [
      ['survey', [0]],
      ['surveys', [1]],
      ['serve', [4]],
      ['surgery', [2]],
      ['serge', [6]],
      ['super', [7]],
      ['service', [5]],
      ['surfing', [3]],
    ];

    let radix: RadixBKTreeMap<number>;

    beforeEach(() => {
      radix = new RadixBKTreeMap<number>();
      testWords.forEach((word, i) => radix.insert(word, i));
    });

    it('should return fuzzy matches for maximum edit distance', () => {
      expect(
        radix.getFuzzyMatches('survey', { includeValues: true, maxErrors: 5 }),
      ).toEqual(expected);
      expect(
        radix.getFuzzyMatches('survey', { includeValues: false, maxErrors: 5 }),
      ).toEqual(expected.map(([word]) => word));

      expect(
        radix.getFuzzyMatches('survey', { includeValues: true, maxErrors: 2 }),
      ).toEqual(expected.slice(0, 4));
      expect(
        radix.getFuzzyMatches('survey', { includeValues: false, maxErrors: 2 }),
      ).toEqual(expected.slice(0, 4).map(([word]) => word));
    });

    it('should apply limit correctly', () => {
      expect(
        radix.getFuzzyMatches('survey', {
          includeValues: true,
          maxErrors: 5,
          limit: 3,
        }),
      ).toEqual(expected.slice(0, 3));
      expect(
        radix.getFuzzyMatches('survey', {
          includeValues: false,
          maxErrors: 5,
          limit: 3,
        }),
      ).toEqual(expected.slice(0, 3).map(([word]) => word));
    });

    it('should apply filter correctly', () => {
      expect(
        radix.getFuzzyMatches('survey', {
          includeValues: true,
          maxErrors: 5,
          filter: (values) => values[0] % 2 === 0,
        }),
      ).toEqual(
        // @ts-expect-error
        expected.filter(([_, values]) => values[0] % 2 === 0),
      );
    });

    test.prop([
      fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 })),
      fc.string({ minLength: 1, maxLength: 10 }),
      fc.nat(),
    ])('should correctly return fuzzy matches', (corpus, query, maxErrorss) => {
      const radix = new RadixBKTreeMap<number>();
      corpus.forEach((word, i) => radix.insert(word, i));

      const expected = corpus
        .map((word, i) => ({
          match: word,
          distance: getEditDistanceRef(word, query),
          values: [i],
        }))
        .sort((a, b) => {
          const diff = a.distance - b.distance;
          return diff === 0 ? a.match.localeCompare(b.match) : diff;
        })
        .filter(({ distance }) => distance <= maxErrorss);

      const actual = radix.getFuzzyMatches(query, {
        maxErrors: maxErrorss,
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

  describe('getPrefixMatches', () => {
    let radix: RadixBKTreeMap<number>;

    beforeEach(() => {
      // Insert test data
      radix = new RadixBKTreeMap<number>();
      radix.insert('apple', 1);
      radix.insert('appetite', 2);
      radix.insert('appetizer', 3);
      radix.insert('application', 4);
      radix.insert('banana', 5);
      radix.insert('band', 6);
      radix.insert('bandana', 7);
      radix.insert('bandit', 8);
      radix.insert('zebra', 9);
    });

    it('should return all words for empty string', () => {
      const result = radix.getPrefixMatches('');
      const expected = [
        'appetite',
        'appetizer',
        'apple',
        'application',
        'banana',
        'band',
        'bandana',
        'bandit',
        'zebra',
      ];
      result.sort();
      expect(result).toHaveLength(expected.length);
      expect(result).toEqual(expected);
    });

    it('should return empty array for non-existent prefix', () => {
      expect(radix.getPrefixMatches('xyz')).toEqual([]);
    });

    it('should return exact match', () => {
      const expected = ['banana'];
      expect(
        radix.getPrefixMatches('banana', { includeValues: false }),
      ).toEqual(expected);
    });

    it('should return all words with given prefix', () => {
      const expected = ['banana', 'band', 'bandana', 'bandit'];
      const result = radix.getPrefixMatches('ban', { includeValues: false });
      expect(result).toHaveLength(expected.length);
      expect(result).toEqual(expected);
    });

    it('should handle single character prefix', () => {
      const expected = ['banana', 'band', 'bandana', 'bandit'];
      const result = radix.getPrefixMatches('b', { includeValues: false });
      expect(result).toHaveLength(expected.length);
      expect(result).toEqual(expected);
    });

    it('should handle prefix that matches a complete word', () => {
      const expected = ['band', 'bandana', 'bandit'];
      const result = radix.getPrefixMatches('band', { includeValues: false });
      expect(result).toHaveLength(expected.length);
      expect(result).toEqual(expected);
    });

    it('should respect the limit parameter', () => {
      const expected = ['banana', 'band'];
      const result = radix.getPrefixMatches('ban', {
        limit: 1,
        includeValues: false,
      });
      expect(result).toHaveLength(1);
      expect(result).toEqual(['banana']);
    });

    it('should handle unicode characters correctly', () => {
      radix.insert('café', 10);
      radix.insert('cafeteria', 11);

      const result = radix.getPrefixMatches('café', { includeValues: false });
      expect(result).toEqual(['café']);
    });

    it('should handle case sensitivity', () => {
      radix.insert('Apple', 12);
      const result = radix.getPrefixMatches('App', { includeValues: false });
      expect(result).toEqual(['Apple']);
    });

    it('should not contain smaller prefixes in result', () => {
      radix.insert('Apple', 12);
      const result = radix.getPrefixMatches('Apples', { includeValues: false });
      expect(result).toEqual([]);
    });

    it('should not return non-leaf nodes', () => {
      const radix = new RadixBKTreeMap<number>();
      radix.insert('bandano', 1);
      radix.insert('bandana', 2);
      radix.insert('bandit', 3);
      radix.insert('box', 4);
      const result = radix.getPrefixMatches('b', { includeValues: false });
      expect(result).toEqual(['bandana', 'bandano', 'bandit', 'box']);
    });

    it('should filter correctly', () => {
      const radix = new RadixBKTreeMap<number>();
      radix.insert('bandano', 1);
      radix.insert('bandana', 2);
      radix.insert('bandit', 3);
      radix.insert('box', 4);
      const result = radix.getPrefixMatches('b', {
        includeValues: false,
        filter: (values) => values[0] % 2 === 0,
      });
      expect(result).toEqual(['bandana', 'box']);
    });

    test.prop([fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 }))])(
      'should return all strings with empty prefix',
      (corpus) => {
        const radix = new RadixBKTreeMap<number>();
        corpus.forEach((word, i) => radix.insert(word, i));
        const result = radix.getPrefixMatches('', { includeValues: false });
        expect(result.sort()).toEqual(corpus.sort());
      },
    );
  });

  describe('toJSON + fromJSON', () => {
    it('should serialize and deserialize correctly', () => {
      const radix = new RadixBKTreeMap<number>();
      radix.insert('x', 3);

      const jsonStr = radix.toJSON();
      const newRadix = RadixBKTreeMap.fromJSON<number>(jsonStr);

      expect(newRadix.lookup('x')).toEqual([3]);
    });

    test.prop([fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 }))])(
      'should serialize and deserialize correctly',
      (corpus: string[]) => {
        const radix = new RadixBKTreeMap<number>();
        corpus.forEach((word, i) => radix.insert(word, i));
        const newRadix = RadixBKTreeMap.fromJSON<number>(radix.toJSON());

        // @ts-expect-error
        expect(isEqualTreeStrict(radix.root, newRadix.root)).toEqual(true);
      },
    );

    test.prop([
      fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 })),
      fc.nat({ max: 10 }),
    ])(
      'should return the same string when serializing a deserialized tree',
      (corpus, iterations) => {
        const radix = new RadixBKTreeMap<number>();
        corpus.forEach((word, i) => radix.insert(word, i));
        const jsonStr = radix.toJSON();

        let radixCopy = radix;
        for (let i = 0; i < iterations; i++) {
          radixCopy = RadixBKTreeMap.fromJSON<number>(radixCopy.toJSON());
        }
        expect(radixCopy.toJSON()).toEqual(jsonStr);
      },
    );
  });
});

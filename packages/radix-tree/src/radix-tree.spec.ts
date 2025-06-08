import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import type { RadixTreeMapNode } from '.';
import { RadixTree, RadixTreeMap } from './radix-tree';

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

const traverse = <T>(
  node: RadixTreeMapNode<T>,
  visit: (node: RadixTreeMapNode<T>) => void,
) => {
  visit(node);
  for (const child of Object.values(node[0])) {
    traverse(child, visit);
  }
};

describe('RadixTree / RadixTreeMap', () => {
  describe('insert + lookup', () => {
    it('should insert and search sequences correctly', () => {
      const radix = new RadixTreeMap<number>();
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
        const radix = new RadixTreeMap<number>();
        corpus.forEach((word, i) => radix.insert(word, i));
        return corpus.every((word, i) => {
          const found = radix.lookup(word);
          return found !== null && found.length === 1 && found[0] === i;
        });
      },
    );

    test.prop([fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 }))])(
      'should never have common prefixes among children',
      (corpus) => {
        const radix = new RadixTreeMap<number>();
        corpus.forEach((word) => radix.insert(word, 0));
        let ok = true;
        // @ts-expect-error
        traverse(radix.root, (node) => {
          const firstChars = Object.keys(node[0]).map((k) => k[0]);
          if (firstChars.length !== new Set(firstChars).size) {
            ok = false;
          }
        });
        return ok;
      },
    );
  });

  describe('toJSON + fromJSON', () => {
    test.prop([fc.uniqueArray(fc.string({ minLength: 1 }), { minLength: 1 })])(
      'should serialize and deserialize correctly',
      (corpus) => {
        const radix = new RadixTree();
        corpus.forEach((word) => radix.insert(word));
        const json = radix.toJSON();
        const radix2 = RadixTree.fromJSON(json);
        for (const word of corpus) {
          expect(radix2.has(word)).toEqual(true);
        }
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

    const radix = new RadixTreeMap<number>();
    testWords.forEach((word, i) => radix.insert(word, i));

    it('should fuzzy search correctly', () => {
      expect(
        radix.getFuzzyMatches('survey', { maxErrors: 5, includeValues: true }),
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
        radix.getFuzzyMatches('survey', { maxErrors: 2, includeValues: true }),
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
      const radix = new RadixTreeMap<number>();
      corpus.forEach((word, i) => radix.insert(word, i));

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

      const actual = radix.getFuzzyMatches(query, {
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

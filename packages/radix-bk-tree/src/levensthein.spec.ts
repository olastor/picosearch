import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { getEditDistance } from './levensthein';

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

describe('getEditDistance', () => {
  // Single operation tests
  it('should handle single insert operations', () => {
    expect(getEditDistance('', 'a')).toBe(1);
    expect(getEditDistance('a', 'ab')).toBe(1);
    expect(getEditDistance('b', 'ab')).toBe(1);
    expect(getEditDistance('ac', 'abc')).toBe(1);
  });

  it('should handle single delete operations', () => {
    expect(getEditDistance('a', '')).toBe(1);
    expect(getEditDistance('ab', 'a')).toBe(1);
    expect(getEditDistance('ab', 'b')).toBe(1);
    expect(getEditDistance('abc', 'ac')).toBe(1);
  });

  it('should handle single substitution operations', () => {
    expect(getEditDistance('a', 'b')).toBe(1);
    expect(getEditDistance('cat', 'bat')).toBe(1);
    expect(getEditDistance('dog', 'dig')).toBe(1);
  });

  // Multiple operations tests
  it('should handle multiple operations', () => {
    // kitten -> sitting (k→s, e→i, insert g at end)
    expect(getEditDistance('kitten', 'sitting')).toBe(3);

    // sunday -> saturday (insert a and t, n→r, a→u)
    expect(getEditDistance('sunday', 'saturday')).toBe(3);

    // intention -> execution (i→e, t→x, insert c, n→u, t→c, insert u, insert o)
    expect(getEditDistance('intention', 'execution')).toBe(5);
  });

  // Edge cases
  it('should handle empty strings', () => {
    expect(getEditDistance('', '')).toBe(0);
    expect(getEditDistance('', 'abc')).toBe(3);
    expect(getEditDistance('abc', '')).toBe(3);
  });

  it('should handle unicode characters correctly', () => {
    expect(getEditDistance('café', 'cafe')).toBe(1); // é → e
    expect(getEditDistance('straße', 'strasse')).toBe(2); // ß → ss, a → e
    expect(getEditDistance('👋🌍', '👋🌎')).toBe(1); // 🌍 → 🌎
  });

  it('should be case-sensitive', () => {
    expect(getEditDistance('a', 'A')).toBe(1);
    expect(getEditDistance('Hello', 'hello')).toBe(1);
    // 'Case' vs 'CASE' requires 3 substitutions (a→A, s→S, e→E)
    expect(getEditDistance('Case', 'CASE')).toBe(3);
  });

  // Property-based tests
  test.prop([fc.string({ minLength: 0, maxLength: 1000 })])(
    'should satisfy the identity property (distance to self is 0)',
    (str: string) => {
      expect(getEditDistance(str, str)).toBe(0);
    },
  );

  test.prop([
    fc.string({ minLength: 0, maxLength: 1000 }),
    fc.string({ minLength: 0, maxLength: 1000 }),
  ])(
    'should satisfy the symmetry property (distance(a,b) === distance(b,a))',
    (a: string, b: string) => {
      expect(getEditDistance(a, b)).toBe(getEditDistance(b, a));
    },
  );

  test.prop([
    fc.tuple(
      fc.string({ minLength: 0, maxLength: 1000 }),
      fc.string({ minLength: 0, maxLength: 1000 }),
      fc.string({ minLength: 0, maxLength: 1000 }),
    ),
  ])(
    'should satisfy the triangle inequality (distance(a,c) ≤ distance(a,b) + distance(b,c))',
    ([a, b, c]: [string, string, string]) => {
      const ab = getEditDistance(a, b);
      const bc = getEditDistance(b, c);
      const ac = getEditDistance(a, c);

      expect(ac).toBeLessThanOrEqual(ab + bc);
    },
  );

  test.prop([
    fc.tuple(
      fc.string({ minLength: 0, maxLength: 1000 }),
      fc.string({ minLength: 0, maxLength: 1000 }),
    ),
  ])(
    'should be equal to the reference implementation',
    ([a, b]: [string, string]) => {
      expect(getEditDistance(a, b)).toBe(getEditDistanceRef(a, b));
    },
  );
});

import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { BKTree } from './bk-tree';
import { getEditDistance } from './levensthein';

//fc.configureGlobal({ numRuns: 1000 });

describe('BKTree', () => {
  describe('insert + lookup', () => {
    test.prop([fc.uniqueArray(fc.string({ minLength: 1 }))])(
      'should insert and lookup correctly',
      (corpus) => {
        const bk = new BKTree();
        corpus.forEach((w) => bk.insert(w));
        for (const w of corpus) {
          expect(bk.lookup(w)).toEqual(w);
        }
      },
    );
  });

  describe('find', () => {
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

    const bk = new BKTree();
    testWords.forEach((w) => bk.insert(w));

    it('should find correctly', () => {
      expect(bk.find('survey', { maxError: 5 })).toEqual([
        'survey',
        'surveys',
        'serve',
        'surgery',
        'serge',
        'super',
        'service',
        'surfing',
      ]);
    });

    it('should filter max errors correctly', () => {
      expect(bk.find('survey', { maxError: 2 })).toEqual([
        'survey',
        'surveys',
        'serve',
        'surgery',
      ]);
    });

    it('should limit correctly', () => {
      expect(bk.find('survey', { maxError: 2, limit: 3 })).toEqual([
        'survey',
        'surveys',
        'serve',
      ]);
    });

    test.prop([
      fc.uniqueArray(fc.string({ minLength: 1 })),
      fc.string({ minLength: 1 }),
      fc.nat(),
      fc.integer({ min: 1 }),
    ])('should detect the substring', (corpus, query, maxErrors, limit) => {
      const bk = new BKTree();
      corpus.forEach((word) => bk.insert(word));

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
        .filter(({ distance }) => distance <= maxErrors)
        .slice(0, limit);

      const actual = bk.find(query, { maxError: maxErrors, limit });

      return (
        expected.length === actual.length &&
        actual.every((word, i) => expected[i].match === word)
      );
    });
  });

  describe('toJSON + fromJSON', () => {
    test.prop([fc.uniqueArray(fc.string({ minLength: 1 }), { minLength: 1 })])(
      'should serialize and deserialize correctly',
      (corpus) => {
        const bk = new BKTree();
        corpus.forEach((word) => bk.insert(word));
        const json = bk.toJSON();
        const bk2 = BKTree.fromJSON(json);
        for (const word of corpus) {
          expect(bk2.lookup(word)).toEqual(word);
        }
      },
    );
  });
});

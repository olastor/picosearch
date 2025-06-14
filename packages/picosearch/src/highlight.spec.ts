import { fc, test } from '@fast-check/vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { highlightText } from './highlight';

fc.configureGlobal({ numRuns: 100 });

describe('Highlight', () => {
  describe('highlightText', () => {
    it('should highlight words matching the query using the analyzer', () => {
      expect(
        highlightText(
          new Set(['hel']),
          'Hello World',
          (token: string) => 'hel',
          (doc: string) => doc.split(/\s+/),
        ),
      ).toBe('<b>Hello</b> <b>World</b>');
    });

    test.prop([fc.array(fc.stringMatching(/^\S{1,20}$/))])(
      'should reconstruct the document without highlighting',
      (words) => {
        expect(
          highlightText(
            new Set(),
            words.join(' '),
            (token: string) => token,
            (doc: string) => doc.split(/\s+/),
          ),
        ).toBe(words.join(' '));
      },
    );

    test.prop([fc.array(fc.stringMatching(/^\S{1,20}$/))])(
      'should reconstruct the document with highlighting when all words are highlighted',
      (words) => {
        expect(
          highlightText(
            new Set(words),
            words.join(' '),
            (token: string) => token,
            (doc: string) => doc.split(/\s+/),
          ),
        ).toBe(words.map((word) => `<b>${word}</b>`).join(' '));
      },
    );

    test.prop([
      fc.array(fc.stringMatching(/^\S{1,20}$/), { minLength: 1 }).chain((t) =>
        fc.record({
          words: fc.constantFrom(t),
          highlightedIndices: fc.uniqueArray(
            fc.integer({ min: 0, max: t.length - 1 }),
            { minLength: 1 },
          ),
        }),
      ),
    ])(
      'should reconstruct the document with highlighting when random words are highlighted',
      ({ words, highlightedIndices }) => {
        const highlightedWords = new Set(
          words.filter((_, i) => highlightedIndices.includes(i)),
        );
        expect(
          highlightText(
            highlightedWords,
            words.join(' '),
            (token: string) => token,
            (doc: string) => doc.split(/\s+/),
          ),
        ).toBe(
          words
            .map((word) =>
              highlightedWords.has(word) ? `<b>${word}</b>` : word,
            )
            .join(' '),
        );
      },
    );
  });
});

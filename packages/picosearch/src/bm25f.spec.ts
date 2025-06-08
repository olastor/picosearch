import { describe, expect, it } from 'vitest';
import { scoreBM25F } from './bm25f';
import type { PicosearchDocument, SearchIndex } from './types';

describe('scoreBM25F', () => {
  it('calculates scores for documents correctly', () => {
    interface TestDoc extends PicosearchDocument {}
    const queryTokens = new Set(['test']);
    const index: Partial<SearchIndex<TestDoc>> = {
      originalDocumentIds: ['0', '1'],
      docCountsByFieldId: [2],
      totalDocLengthsByFieldId: [100],
      termTree: {
        lookup: () => [
          [0, 0, 1],
          [1, 0, 2],
        ],
      } as any,
      docLengths: { 0: [50], 1: [50] },
      docsById: { 0: { id: '0' }, 1: { id: '1' } },
    };
    const fieldWeights = { 0: 1 };
    const k1 = 1.2;
    const b = 0.75;

    const results = scoreBM25F(
      queryTokens,
      index as SearchIndex<TestDoc>,
      fieldWeights,
      k1,
      b,
    );
    expect(results).toHaveLength(2);
    expect(results[0][0]).toEqual(1);
    expect(results[1][0]).toEqual(0);
    expect(results[0][1]).toBeGreaterThan(results[1][0]);
  });
});

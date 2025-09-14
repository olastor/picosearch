import type { SearchIndex } from './schemas';
import type { Document } from './types';

/**
 * Calculates scores for documents matching the query tokens and returns a ranked list of most
 * relevant documents. The formula used is the simple BM25F version as specified in [1] and used
 * by Elasticsearch's "combined_field" query [2] for scoring across multiple field in the same index.
 *
 * [1] http://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf
 * [2] https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-combined-fields-query.html
 * [3] https://arxiv.org/pdf/0911.5046.pdf
 */
export const scoreBM25F = <T extends Document>(
  queryTokens: Set<string>,
  index: SearchIndex<T>,
  fieldWeights: { [fieldId: number]: number },
  k1: number,
  b: number,
): [internalId: number, score: number][] => {
  const docScores: { [doc: number]: number } = {};

  const selectedFieldIds = Object.entries(fieldWeights)
    .filter(([, weight]) => weight > 0)
    .map(([fieldId]) => Number.parseInt(fieldId));

  const numberOfDocs = Math.max(
    ...selectedFieldIds.map((fieldId) => index.docCountsByFieldId[fieldId]),
  );

  const avgDl: number = selectedFieldIds
    .map(
      (fieldId) =>
        (fieldWeights[fieldId] * index.totalDocLengthsByFieldId[fieldId]) /
        numberOfDocs,
    )
    .reduce((acc, x) => acc + x, 0);

  for (const token of queryTokens) {
    const dlTilde: { [docId: number]: number } = {};
    const tfTilde: { [docId: number]: number } = {};
    const docIds = new Set<number>();

    const result = index.termTree.lookup(token);
    if (result) {
      for (const item of result) {
        if (item === 1) continue;
        const [docId, fieldId, frequency] = item;
        if (!selectedFieldIds.includes(fieldId)) continue;
        docIds.add(docId);
        tfTilde[docId] =
          (tfTilde[docId] || 0) + fieldWeights[fieldId] * frequency;
        dlTilde[docId] =
          (dlTilde[docId] || 0) +
          fieldWeights[fieldId] * index.docLengths[docId][fieldId];
      }
    }

    const df = docIds.size;
    for (const docId of docIds) {
      const idf = Math.log(1 + (numberOfDocs - df + 0.5) / (df + 0.5));

      const score =
        (tfTilde[docId] /
          (tfTilde[docId] + k1 * (1 - b + (b * dlTilde[docId]) / avgDl))) *
        idf;

      docScores[docId] = (docScores[docId] || 0) + score;
    }
  }

  return Object.entries(docScores)
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => [Number(id), score]);
};

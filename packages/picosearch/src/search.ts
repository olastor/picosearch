import { scoreBM25F } from './bm25f';
import { highlightText } from './highlight';
import type { SearchIndex } from './schemas';
import type {
  ParsedAutocompleteOptions,
  ParsedOptions,
  ParsedQueryOptions,
} from './schemas';
import type { Document, RawTokenMarker, TokenInfo } from './types';
import {
  assert,
  fetchFromRemote,
  getAutoFuzziness,
  parseFieldNameAndWeight,
} from './util';

export const getDocumentByInternalId = async <T extends Document>(
  internalId: number,
  opts: ParsedOptions<T>,
  searchIndex: SearchIndex<T>,
): Promise<T | null> => {
  if (opts.keepDocuments) {
    return Promise.resolve(searchIndex.docsById?.[internalId] ?? null);
  }

  const originalId = searchIndex.originalDocumentIds[internalId];

  if (opts.fetchDocumentUrl) {
    const documentUrl = opts.fetchDocumentUrl.replace('{id}', originalId);
    const result = await fetchFromRemote<T>(documentUrl, false);
    return result.data ?? null;
  }

  if (opts.getDocumentById) {
    return opts.getDocumentById(originalId);
  }

  return Promise.resolve(null);
};

export const search =
  <T extends Document>(opts: ParsedOptions<T>, searchIndex: SearchIndex<T>) =>
  async (query: string, queryOptions: ParsedQueryOptions) => {
    const queryTokens: Set<string> = new Set<string>();
    const getDocumentById =
      queryOptions.getDocumentById ?? opts.getDocumentById;
    if (queryOptions.includeDocs && !opts.keepDocuments && !getDocumentById) {
      throw new Error(
        'getDocumentById is required because `keepDocuments` was false during indexing and the index does not contain the documents!',
      );
    }

    opts.tokenizer(query).forEach((rawToken) => {
      const token = opts.analyzer(rawToken);
      if (!token) return;
      queryTokens.add(token);
    });

    const limit = queryOptions.maxExpansions;
    const { fuzziness } = queryOptions;
    if (typeof fuzziness === 'number' && fuzziness > 0) {
      searchIndex.termTree
        .getBatchFuzzyMatches([...queryTokens], {
          maxErrors: fuzziness,
          limit,
        })
        .forEach((word) => queryTokens.add(word));
    } else if (fuzziness === 'AUTO') {
      const queriesByMaxErrors = [...queryTokens].reduce(
        (acc, token) => {
          const maxErrors = getAutoFuzziness(token);
          acc[maxErrors] ??= [];
          acc[maxErrors].push(token);
          return acc;
        },
        {} as Record<number, string[]>,
      );

      Object.entries(queriesByMaxErrors).forEach(([maxErrors, tokens]) => {
        searchIndex.termTree
          .getBatchFuzzyMatches(tokens, {
            maxErrors: Number(maxErrors),
            limit,
          })
          .forEach((word) => queryTokens.add(word));
      });
    }

    const defaultWeight = queryOptions.fields?.length ? 0 : 1;
    const fieldWeights = Object.fromEntries(
      searchIndex.fields.map((_, i) => [i, defaultWeight]),
    );
    if (queryOptions.fields?.length) {
      for (const [fieldName, weight] of queryOptions.fields.map(
        parseFieldNameAndWeight,
      )) {
        const fieldId = searchIndex.fields.indexOf(fieldName);
        if (fieldId === -1) throw new Error(`Unknown field '${fieldName}'!`);
        fieldWeights[fieldId] = weight;
      }
    }

    const k1 = queryOptions.bm25.k1;
    const b = queryOptions.bm25.b;

    const offset = queryOptions.offset;
    const results = scoreBM25F<T>(
      queryTokens,
      searchIndex,
      fieldWeights,
      k1,
      b,
    ).slice(
      offset,
      queryOptions.limit ? offset + queryOptions.limit : undefined,
    );

    const { originalDocumentIds } = searchIndex;

    if (queryOptions.includeDocs) {
      const promises = results.map(async ([internalId, score]) => ({
        id: originalDocumentIds[internalId],
        score,
        doc: queryOptions.getDocumentById
          ? await queryOptions.getDocumentById(originalDocumentIds[internalId])
          : await getDocumentByInternalId(internalId, opts, searchIndex),
      }));

      const resultWithDocs = !queryOptions.ignoreErrors
        ? await Promise.all(promises)
        : await Promise.allSettled(promises).then((settledResults) =>
            settledResults.map((settledResult, i) =>
              settledResult.status === 'fulfilled'
                ? {
                    id: settledResult.value.id,
                    score: settledResult.value.score,
                    doc: settledResult.value.doc,
                  }
                : {
                    id: originalDocumentIds[results[i][0]],
                    score: results[i][1],
                    doc: null,
                  },
            ),
          );

      if (queryOptions.highlightedFields?.length) {
        for (const result of resultWithDocs) {
          for (const fieldName of queryOptions.highlightedFields as (keyof T)[]) {
            if (
              !result.doc?.[fieldName] ||
              typeof result.doc[fieldName] !== 'string'
            ) {
              continue;
            }

            result.doc[fieldName] = highlightText(
              queryTokens,
              result.doc[fieldName],
              opts.analyzer,
              opts.tokenizer,
              queryOptions.highlightTag.before,
              queryOptions.highlightTag.after,
            ) as T[keyof T];
          }
        }
      }

      return resultWithDocs;
    }

    return results.map(([internalId, score]) => ({
      id: originalDocumentIds[internalId],
      score,
    }));
  };

export const autocomplete =
  <T extends Document>(opts: ParsedOptions<T>, searchIndex: SearchIndex<T>) =>
  (word: string, options: ParsedAutocompleteOptions): string[] => {
    assert(opts.enableAutocomplete, 'Autocomplete is not enabled!');

    const { limit, method, fuzziness } = options;
    const wordLower = word.toLowerCase();

    if (method === 'prefix') {
      return searchIndex.termTree.getPrefixMatches(wordLower, {
        limit,
        includeValues: false,
        // we need a filter to exclude tokens that were only indexed as analyzed tokens
        filter: (values: (TokenInfo | RawTokenMarker)[]) => values[0] === 1,
      });
    }

    const maxErrors =
      fuzziness === 'AUTO' ? getAutoFuzziness(wordLower) : fuzziness;

    // no filter needed here because all analyzed tokens were earlier indexed using insertNoFuzzy
    return searchIndex.termTree.getFuzzyMatches(wordLower, {
      maxErrors,
      limit,
      includeValues: false,
    });
  };

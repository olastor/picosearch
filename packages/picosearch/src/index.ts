import { RadixBKTreeMap } from '@picosearch/radix-bk-tree';
import { scoreBM25F } from './bm25f';
import {
  DEFAULT_AUTOCOMPLETE_OPTIONS,
  DEFAULT_ID_FIELD,
  DEFAULT_QUERY_OPTIONS,
} from './constants';
import { highlightText } from './highlight';
import type {
  Analyzer,
  AutocompleteOptions,
  GetDocumentById,
  IPicosearch,
  Patch,
  PatchChange,
  PicosearchDocument,
  PicosearchOptions,
  QueryOptions,
  RawTokenMarker,
  SearchIndex,
  SearchResult,
  SearchResultWithDoc,
  SerializedInstance,
  TokenInfo,
  Tokenizer,
} from './types';
import { assert, getAutoFuzziness, parseFieldNameAndWeight } from './util';

/**
 * The default tokenizer, which splits the document into words by matching \w+.
 */
export const defaultTokenizer: Tokenizer = (doc: string): string[] =>
  doc.match(/\w+/g) || [];

/**
 * The default analyzer, which only lowercases the token.
 */
export const defaultAnalyzer: Analyzer = (token: string): string =>
  token.toLowerCase();

export type {
  Analyzer,
  PicosearchDocument,
  PicosearchOptions,
  QueryOptions,
  SearchIndex,
  SearchResult,
  SerializedInstance,
  Tokenizer,
};

export class Picosearch<T extends PicosearchDocument>
  implements IPicosearch<T>
{
  private tokenizer: Tokenizer = defaultTokenizer;
  private analyzer: Analyzer = defaultAnalyzer;
  private keepDocuments = true;
  private enableAutocomplete = false;
  private getDocumentById?: GetDocumentById<T>;
  private idField = DEFAULT_ID_FIELD;
  private searchIndex: SearchIndex<T>;
  private indexedFields?: (keyof T)[];

  /**
   * Creates a new Picosearch instance.
   * @param options The options to use for the Picosearch instance.
   */
  constructor(
    {
      tokenizer,
      analyzer,
      keepDocuments,
      searchIndex,
      enableAutocomplete,
      getDocumentById,
      idField,
      indexedFields,
    }: PicosearchOptions<T> = {
      tokenizer: defaultTokenizer,
      analyzer: defaultAnalyzer,
      keepDocuments: true,
      enableAutocomplete: false,
      getDocumentById: undefined,
      idField: DEFAULT_ID_FIELD,
    },
  ) {
    if (tokenizer) this.tokenizer = tokenizer;
    if (analyzer) this.analyzer = analyzer;
    if (typeof keepDocuments === 'boolean') this.keepDocuments = keepDocuments;
    if (typeof enableAutocomplete === 'boolean')
      this.enableAutocomplete = enableAutocomplete;
    if (typeof getDocumentById === 'function')
      this.getDocumentById = getDocumentById;
    if (typeof idField === 'string') this.idField = idField;
    if (Array.isArray(indexedFields)) {
      indexedFields.forEach((field) =>
        assert(
          typeof field === 'string',
          'All fields in `indexedFields` must be strings',
        ),
      );
      this.indexedFields = indexedFields;
    }
    if (searchIndex) {
      this.searchIndex = searchIndex;
      return;
    }
    this.searchIndex = {
      specVersion: 1,
      version: 0,
      originalDocumentIds: [],
      fields: [],
      termTree: new RadixBKTreeMap<TokenInfo | RawTokenMarker>(),
      docLengths: {},
      totalDocLengthsByFieldId: {},
      docCountsByFieldId: {},
      docCount: 0,
      docsById: {},
    };
  }

  /**
   * Creates a patch to add documents to the index. This leaves the search index unchanged
   * and returns an object that can be passed to `applyPatch` to update the same index.
   *
   * This is useful for scenarios where you want to provide small incremental updates to an existing
   * search index without having to replace the entire index.
   *
   * @param add The documents to add to the index.
   * @returns A patch that can be passed to `applyPatch` to update the same index.
   */
  createPatch({ add }: { add: T[] }): Patch<T> {
    const change: PatchChange<T> = {
      type: 'add',
      addedFields: [],
      addedOriginalDocumentIds: [],
      addedTermTreeLeaves: Object.create(null),
      addedDocLengths: Object.create(null),
      addedTotalDocLengthsByFieldId: {},
      addedDocCountsByFieldId: {},
      addedDocCount: add.length,
    };

    for (let i = 0; i < add.length; i++) {
      const document = add[i];

      if (
        typeof document[this.idField] !== 'string' ||
        document[this.idField] === ''
      ) {
        throw new Error(
          `The document's required '${this.idField}' field is missing or not a string. Got: ${document[this.idField]}`,
        );
      }

      if (
        this.searchIndex.originalDocumentIds.includes(document[this.idField])
      ) {
        throw new Error(`Duplicate document ID: ${document[this.idField]}`);
      }

      const internalDocId = this.searchIndex.originalDocumentIds.length + i;
      change.addedOriginalDocumentIds.push(document[this.idField]);

      for (const field of Object.keys(document)) {
        if (
          field === this.idField ||
          (this.indexedFields && !this.indexedFields.includes(field))
        ) {
          continue;
        }

        let fieldId = [
          ...this.searchIndex.fields,
          ...change.addedFields,
        ].findIndex((f) => f === field);
        if (fieldId < 0) {
          fieldId = this.searchIndex.fields.length + change.addedFields.length;
          change.addedFields.push(field);
        }

        const fieldTokens: string[] = [];

        // the unprocessed tokens are only for fuzyy search / autocomplete,
        // so their frequency doesn't matter and we use a set
        const fieldTokensRaw: Set<string> = new Set<string>();

        this.tokenizer(document[field]).forEach((rawToken) => {
          const token = this.analyzer(rawToken);
          if (!token) return;
          fieldTokens.push(token);
          if (this.enableAutocomplete) fieldTokensRaw.add(rawToken);
        });

        change.addedDocLengths[internalDocId] ??= {};
        change.addedTotalDocLengthsByFieldId[fieldId] ??= 0;
        change.addedDocCountsByFieldId[fieldId] ??= 0;

        change.addedDocLengths[internalDocId][fieldId] = fieldTokens.length;
        change.addedTotalDocLengthsByFieldId[fieldId] += fieldTokens.length;
        change.addedDocCountsByFieldId[fieldId]++;

        const fieldTokenFreqs = fieldTokens.reduce(
          (acc: { [token: string]: number }, token: string) => {
            acc[token] = (acc[token] || 0) + 1;
            return acc;
          },
          {},
        );

        for (const rawToken of fieldTokensRaw) {
          // raw tokens are indexed only for fuzzy search / autocomplete
          // make sure they are marked with 1
          const rawTokenLower = rawToken.toLowerCase();
          change.addedTermTreeLeaves[rawTokenLower] ??= [];
          if (change.addedTermTreeLeaves[rawTokenLower][0] !== 1) {
            change.addedTermTreeLeaves[rawTokenLower].unshift(1);
          }
        }

        for (const [token, frequency] of Object.entries(fieldTokenFreqs)) {
          const tokenInfo: TokenInfo = [internalDocId, fieldId, frequency];
          change.addedTermTreeLeaves[token] ??= [];
          change.addedTermTreeLeaves[token].push(tokenInfo);
        }
      }

      if (this.keepDocuments) {
        change.addedDocsById ??= {};
        change.addedDocsById[internalDocId] = document;
      }
    }

    return {
      version: this.searchIndex.version + 1,
      changes: [change],
    };
  }

  /**
   * Applies a patch to the index. This will update the index in place.
   * The patch must have been created from the current index (not necessarily the same instance, though)
   * and there must not have been a different patch of the same version applied to this instance already.
   *
   * @param patch The patch to apply.
   */
  applyPatch(patch: Patch<T>): void {
    assert(
      this.searchIndex.version === patch.version - 1,
      `Expected patch to have version ${this.searchIndex.version}, got: ${patch.version}`,
    );

    this.searchIndex.version = patch.version;
    for (const change of patch.changes) {
      assert(change.type === 'add', 'change type must be add');

      this.searchIndex.fields.push(...change.addedFields);
      this.searchIndex.originalDocumentIds.push(
        ...change.addedOriginalDocumentIds,
      );
      for (const [token, values] of Object.entries(
        change.addedTermTreeLeaves,
      )) {
        if (values[0] === 1) {
          this.searchIndex.termTree.insert(token);
          const node = this.searchIndex.termTree.lookup(token, true);
          assert(!!node, 'node is undefined');
          node.v ??= [];
          if (node.v[0] !== 1) node.v.unshift(1);
          const tokenInfos = values.slice(1);
          this.searchIndex.termTree.insertNoFuzzy(token, ...tokenInfos);
        } else {
          this.searchIndex.termTree.insertNoFuzzy(token, ...values);
        }
      }
      this.searchIndex.docLengths = {
        ...this.searchIndex.docLengths,
        ...change.addedDocLengths,
      };
      for (const [fieldId, addedLength] of Object.entries(
        change.addedTotalDocLengthsByFieldId,
      )) {
        this.searchIndex.totalDocLengthsByFieldId[Number(fieldId)] =
          (this.searchIndex.totalDocLengthsByFieldId[Number(fieldId)] ?? 0) +
          addedLength;
      }
      for (const [fieldId, addedCount] of Object.entries(
        change.addedDocCountsByFieldId,
      )) {
        this.searchIndex.docCountsByFieldId[Number(fieldId)] =
          (this.searchIndex.docCountsByFieldId[Number(fieldId)] ?? 0) +
          addedCount;
      }
      this.searchIndex.docCount += patch.changes[0].addedDocCount;
      this.searchIndex.docsById = {
        ...this.searchIndex.docsById,
        ...change.addedDocsById,
      };
    }
  }

  /**
   * Inserts multiple documents into the index.
   * @param documents The documents to insert.
   */
  insertDocument(document: T): void {
    this.insertMultipleDocuments([document]);
  }

  /**
   * Inserts a document into the index.
   * @param document The document to insert.
   */
  insertMultipleDocuments(documents: T[]): void {
    this.applyPatch(this.createPatch({ add: documents }));
  }

  /**
   * Searches for documents matching the query string.
   *
   * @param query The query string to search for.
   * @param options The options to use for the search.
   *
   * @returns An array of search results together with the documents.
   */
  async searchDocuments(
    query: string,
    options?: Omit<QueryOptions<T>, 'includeDocs'> & { includeDocs: true },
  ): Promise<SearchResultWithDoc<T>[]>;

  /**
   * Searches for documents matching the query string.
   *
   * @param query The query string to search for.
   * @param options The options to use for the search.
   *
   * @returns An array of search results.
   */
  async searchDocuments(
    query: string,
    options?: Omit<QueryOptions<T>, 'includeDocs'> & { includeDocs?: false },
  ): Promise<SearchResult[]>;

  async searchDocuments(
    query: string,
    options: QueryOptions<T> = DEFAULT_QUERY_OPTIONS,
  ): Promise<SearchResult[] | SearchResultWithDoc<T>[]> {
    const queryTokens: Set<string> = new Set<string>();
    const getDocumentById = options.getDocumentById ?? this.getDocumentById;
    if (options.includeDocs && !this.keepDocuments && !getDocumentById) {
      throw new Error(
        'getDocumentById is required because `keepDocuments` was false during indexing and the index does not contain the documents!',
      );
    }

    this.tokenizer(query).forEach((rawToken) => {
      const token = this.analyzer(rawToken);
      if (!token) return;
      queryTokens.add(token);
    });

    const limit = options?.maxExpansions ?? DEFAULT_QUERY_OPTIONS.maxExpansions;
    const { fuzziness } = options;
    if (typeof fuzziness === 'number' && fuzziness > 0) {
      this.searchIndex.termTree
        .getBatchFuzzyMatches([...queryTokens], {
          maxErrors: fuzziness,
          limit,
        })
        .forEach((word) => queryTokens.add(word));
    } else if (options?.fuzziness === 'AUTO') {
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
        this.searchIndex.termTree
          .getBatchFuzzyMatches(tokens, {
            maxErrors: Number(maxErrors),
            limit,
          })
          .forEach((word) => queryTokens.add(word));
      });
    }

    const defaultWeight = options.fields?.length ? 0 : 1;
    const fieldWeights = Object.fromEntries(
      this.searchIndex.fields.map((_, i) => [i, defaultWeight]),
    );
    if (options.fields?.length) {
      for (const [fieldName, weight] of options.fields.map(
        parseFieldNameAndWeight,
      )) {
        const fieldId = this.searchIndex.fields.indexOf(fieldName);
        if (fieldId === -1) throw new Error(`Unknown field '${fieldName}'!`);
        fieldWeights[fieldId] = weight;
      }
    }

    const k1 = options?.bm25?.k1 ?? DEFAULT_QUERY_OPTIONS.bm25.k1;
    const b = options?.bm25?.b ?? DEFAULT_QUERY_OPTIONS.bm25.b;

    const offset = options.offset ?? 0;
    const results = scoreBM25F<T>(
      queryTokens,
      this.searchIndex,
      fieldWeights,
      k1,
      b,
    ).slice(offset, options?.limit ? offset + options.limit : undefined);

    const { docsById, originalDocumentIds } = this.searchIndex;

    if (options?.includeDocs) {
      let resultWithDocs: SearchResultWithDoc<T>[];
      if (this.keepDocuments && !getDocumentById) {
        resultWithDocs = results.map(([internalId, score]) => {
          const doc = docsById[internalId];
          return {
            id: originalDocumentIds[internalId],
            score,
            doc,
          };
        });
      } else {
        // this assertion is just for the compiler
        assert(!!getDocumentById, 'getDocumentById is undefined!');
        resultWithDocs = await Promise.all(
          results.map(async ([internalId, score]) => {
            const doc = await getDocumentById(originalDocumentIds[internalId]);
            return {
              id: originalDocumentIds[internalId],
              score,
              doc,
            };
          }),
        );
      }

      if (options?.highlightedFields?.length) {
        for (const result of resultWithDocs) {
          for (const fieldName of options.highlightedFields) {
            if (
              !result.doc?.[fieldName] ||
              typeof result.doc[fieldName] !== 'string'
            )
              continue;
            result.doc[fieldName] = highlightText(
              queryTokens,
              result.doc[fieldName],
              this.analyzer,
              this.tokenizer,
              options.highlightTag?.before ??
                DEFAULT_QUERY_OPTIONS.highlightTag.before,
              options.highlightTag?.after ??
                DEFAULT_QUERY_OPTIONS.highlightTag.after,
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
  }

  /**
   * Autocomplete a word with fuzzy matching. Autocompletion is always case-insensitive.
   *
   * @param word The word to autocomplete.
   * @param options The options to use for the autocomplete.
   * @returns An array of autocomplete results.
   */
  autocomplete(
    word: string,
    options: AutocompleteOptions = DEFAULT_AUTOCOMPLETE_OPTIONS,
  ): string[] {
    assert(this.enableAutocomplete, 'Autocomplete is not enabled!');

    const limit = options?.limit ?? DEFAULT_AUTOCOMPLETE_OPTIONS.limit;
    const wordLower = word.toLowerCase();

    if (
      options.method === 'prefix' ||
      (!options.method && DEFAULT_AUTOCOMPLETE_OPTIONS.method === 'prefix')
    ) {
      return this.searchIndex.termTree.getPrefixMatches(wordLower, {
        limit,
        includeValues: false,
        // we need a filter to exclude tokens that were only indexed as analyzed tokens
        filter: (values: (TokenInfo | RawTokenMarker)[]) => values[0] === 1,
      });
    }

    const maxErrors =
      !options?.fuzziness || options?.fuzziness === 'AUTO'
        ? getAutoFuzziness(wordLower)
        : options?.fuzziness;

    // no filter needed here because all analyzed tokens were earlier indexed using insertNoFuzzy
    return this.searchIndex.termTree.getFuzzyMatches(wordLower, {
      maxErrors,
      limit,
      includeValues: false,
    });
  }

  /**
   * Serializes the index to a JSON string.
   * @returns A JSON string representing the index.
   */
  toJSON(): string {
    const jsonObj: SerializedInstance<T> = {
      index: {
        ...this.searchIndex,
        termTree: this.searchIndex.termTree.toMinified(),
      },
      opts: {
        keepDocuments: this.keepDocuments,
        enableAutocomplete: this.enableAutocomplete,
        idField: this.idField,
        indexedFields: this.indexedFields,
      },
    };

    return JSON.stringify(jsonObj);
  }

  /**
   * Deserializes a JSON string into a Picosearch instance.
   * @param json The JSON string to deserialize.
   * @param languageOpts Optional language-specific options for the tokenizer and analyzer.
   * @returns A Picosearch instance.
   */
  static fromJSON<T extends PicosearchDocument>(
    json: string,
    languageOpts?: Pick<PicosearchOptions<T>, 'tokenizer' | 'analyzer'>,
  ): Picosearch<T> {
    const { opts, index } = JSON.parse(json) as SerializedInstance<T>;
    const picosearch = new Picosearch<T>({
      ...opts,
      tokenizer: languageOpts?.tokenizer,
      analyzer: languageOpts?.analyzer,
      searchIndex: {
        ...index,
        termTree: RadixBKTreeMap.fromMinified(index.termTree),
      },
    });
    return picosearch;
  }
}

import { RadixBKTreeMap } from '@picosearch/radix-bk-tree';
import { scoreBM25F } from './bm25f';
import {
  DEFAULT_AUTOCOMPLETE_OPTIONS,
  DEFAULT_ID_FIELD,
  DEFAULT_QUERY_OPTIONS,
} from './constants';
import type {
  Analyzer,
  AutocompleteOptions,
  GetDocumentById,
  IPicosearch,
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
   * Inserts a document into the index.
   * @param document The document to insert.
   */
  insertDocument(document: T) {
    if (
      typeof document[this.idField] !== 'string' ||
      document[this.idField] === ''
    ) {
      throw new Error(
        `The document's required '${this.idField}' field is missing or not a string. Got: ${document[this.idField]}`,
      );
    }

    if (this.searchIndex.originalDocumentIds.includes(document[this.idField])) {
      throw new Error(`Duplicate document ID: ${document[this.idField]}`);
    }

    const internalDocId = this.searchIndex.originalDocumentIds.length;
    this.searchIndex.originalDocumentIds.push(document[this.idField]);

    for (const field of Object.keys(document)) {
      if (
        field === this.idField ||
        (this.indexedFields && !this.indexedFields.includes(field))
      )
        continue;

      let fieldId = this.searchIndex.fields.findIndex((f) => f === field);
      if (fieldId < 0) {
        fieldId = this.searchIndex.fields.length;
        this.searchIndex.fields.push(field);
      }

      const fieldTokens: string[] = [];

      // the unprocessed tokens are only for fuzyy search / autocomplete,
      // so their frequency doesn't matter and we use a set
      const fieldTokensRaw: Set<string> = new Set<string>();

      this.tokenizer(document[field]).forEach((rawToken) => {
        const token = this.analyzer(rawToken);
        if (!token) return;
        fieldTokens.push(token);
        fieldTokensRaw.add(rawToken);
      });

      this.searchIndex.docLengths[internalDocId] ??= {};
      this.searchIndex.totalDocLengthsByFieldId[fieldId] ??= 0;
      this.searchIndex.docCountsByFieldId[fieldId] ??= 0;

      this.searchIndex.docLengths[internalDocId][fieldId] = fieldTokens.length;
      this.searchIndex.totalDocLengthsByFieldId[fieldId] += fieldTokens.length;
      this.searchIndex.docCountsByFieldId[fieldId]++;

      const fieldTokenFreqs = fieldTokens.reduce(
        (acc: { [token: string]: number }, token: string) => {
          acc[token] = (acc[token] || 0) + 1;
          return acc;
        },
        {},
      );

      for (const [token, frequency] of Object.entries(fieldTokenFreqs)) {
        const tokenInfo: TokenInfo = [internalDocId, fieldId, frequency];
        this.searchIndex.termTree.insertNoFuzzy(token, tokenInfo);
      }

      if (this.enableAutocomplete) {
        for (const rawToken of fieldTokensRaw) {
          // raw tokens are indexed only for fuzzy search / autocomplete
          // make sure they are marked with 1
          const rawTokenLower = rawToken.toLowerCase();
          this.searchIndex.termTree.insert(rawTokenLower);
          const node = this.searchIndex.termTree.lookup(rawTokenLower, true);
          assert(!!node, 'node is undefined');
          node.v ??= [];
          if (node.v[0] !== 1) node.v.unshift(1);
        }
      }
    }

    if (this.keepDocuments) {
      this.searchIndex.docsById[internalDocId] = document;
    }

    this.searchIndex.docCount++;
  }

  /**
   * Inserts multiple documents into the index.
   * @param documents The documents to insert.
   */
  insertMultipleDocuments(documents: T[]) {
    for (const document of documents) {
      this.insertDocument(document);
    }
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
    const tokens: Set<string> = new Set<string>();
    const getDocumentById = options.getDocumentById ?? this.getDocumentById;
    if (options.includeDocs && !this.keepDocuments && !getDocumentById) {
      throw new Error(
        'getDocumentById is required because `keepDocuments` was false during indexing and the index does not contain the documents!',
      );
    }

    this.tokenizer(query).forEach((rawToken) => {
      const token = this.analyzer(rawToken);
      if (!token) return;
      tokens.add(token);
      const maxErrors =
        options.fuzziness === 'AUTO'
          ? getAutoFuzziness(rawToken)
          : (options?.fuzziness ?? 0);
      if (maxErrors > 0) {
        const limit =
          options?.maxExpansions ?? DEFAULT_QUERY_OPTIONS.maxExpansions;
        const similarWords = this.searchIndex.termTree.getFuzzyMatches(
          rawToken.toLowerCase(),
          {
            maxErrors,
            limit,
          },
        );
        similarWords.forEach((word) => tokens.add(word));
      }
    });

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
      tokens,
      this.searchIndex,
      fieldWeights,
      k1,
      b,
    ).slice(offset, options?.limit ? offset + options.limit : undefined);

    const { docsById, originalDocumentIds } = this.searchIndex;

    if (options?.includeDocs) {
      if (this.keepDocuments && !getDocumentById) {
        return results.map(([internalId, score]) => {
          const doc = docsById[internalId];
          return {
            id: originalDocumentIds[internalId],
            score,
            doc,
          };
        });
      }

      // this assertion is just for the compiler
      assert(!!getDocumentById, 'getDocumentById is undefined!');
      return Promise.all(
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

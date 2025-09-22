import { RadixBKTreeMap } from '@picosearch/radix-bk-tree';
import { z } from 'zod';
import { type Document, defaultAnalyzer, defaultTokenizer } from '.';
import { LANGUAGE_NAMES, PROCESSORS_BY_LANGUAGE } from './constants';
import type { RawTokenMarker, TokenInfo } from './types';

// TODO: consider switching to zod/mini

const StorageDriverSchema = z.object({
  get: z.function({
    input: [],
    output: z.promise(z.string()),
  }),
  persist: z.function({
    input: [z.string()],
    output: z.promise(z.void()),
  }),
  delete: z.function({
    input: [],
    output: z.promise(z.void()),
  }),
});

export type StorageDriver = z.input<typeof StorageDriverSchema>;

const StorageDriverOptionsSchema = z.union([
  z.literal('localstorage'),
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('localstorage'),
      key: z.string(),
    }),
    z.object({
      type: z.literal('custom'),
      driver: StorageDriverSchema,
    }),
  ]),
]);

const SearchIndexSchema = z.object({
  /**
   * Incremented when the format of the index changes
   */
  specVersion: z.literal(1),

  /**
   * A random string to identify the index
   */
  id: z.string(),

  /**
   * Incremented when the index is changed
   */
  version: z.number().positive(),

  /**
   * Unique list of field names, the index will be used as field ID
   */
  fields: z.array(z.string()),

  /**
   * TODO: replace with map and shorter string IDs
   * List of document IDs as passed by the user, the index will be used as document reference ID
   */
  originalDocumentIds: z.array(z.string()),

  /**
   * Tree to lookup both token info for BM25 and raw words for fuzzy/prefix matches;
   * if a leaf is a raw token, it is marked by 1 in the first element of the node values
   */
  termTree: z.instanceof(RadixBKTreeMap<TokenInfo | RawTokenMarker>),

  /**
   * By document ID, get the (token-)length by the field ID
   */
  docLengths: z.record(z.number(), z.record(z.number(), z.number())),

  /**
   * By field ID get the total (token-)length (for this field) across all documents
   */
  totalDocLengthsByFieldId: z.record(z.number(), z.number()),

  /**
   * By field ID get the number of documents with that field
   */
  docCountsByFieldId: z.record(z.number(), z.number()),

  /**
   * The total number of documents
   */
  docCount: z.number().nonnegative(),

  /**
   * By document ID, get the document
   */
  docsById: z.record(z.number(), z.looseObject({})),
});

export type SearchIndex<T extends Document> = z.input<
  typeof SearchIndexSchema
> & {
  docsById: { [documentId: number]: T };
};

export const OptionsSchema = z
  .object({
    /**
     * The language to use for indexing and search.
     * Specifying a language will override the tokenizer and analyzer.
     * Currently supported languages are:
     * - english
     * - german
     */
    language: z.enum(LANGUAGE_NAMES).optional(),

    /**
     * The tokenizer to use for tokenizing documents.
     *
     * @default defaultTokenizer
     */
    tokenizer: z
      .function({
        input: [z.string()],
        output: z.array(z.string()),
      })
      .default(() => defaultTokenizer),

    /**
     * The analyzer to use for analyzing documents.
     *
     * @default defaultAnalyzer
     */
    analyzer: z
      .function({
        input: [z.string()],
        output: z.string(),
      })
      .default(() => defaultAnalyzer),

    /**
     * Whether to keep the documents in the index. Not keeping documents in the index will save much space.
     * If false, you should either use fetchDocumentUrl or getDocumentById to load documents at query time dynamically.
     *
     * @default true
     */
    keepDocuments: z.boolean().default(true),

    /**
     * Whether to enable autocomplete feature. When turned on, the autocomplete() method will be available, but the index will also be significantly larger as the raw words need to be stored for fuzzy/prefix matching.
     *
     * @default false
     */
    enableAutocomplete: z.boolean().default(false),

    /**
     * A custom function for getting a document by ID.
     */
    getDocumentById: z
      .function({
        input: [z.string()],
        // TODO: improve type
        output: z.promise(z.any()),
      })
      .optional(),

    /**
     * The name of the field of the ID.
     *
     * @default 'id'
     */
    idField: z.string().default('id'),

    /**
     * The fields to index. All other fields will not be searchable.
     */
    indexedFields: z.array(z.string()).min(1).optional(),

    /**
     * The URL of the latest JSON-serialized index on a remote storage.
     */
    indexUrl: z.url().optional(),

    /**
     * The URL pattern for subsequent updates to an index.
     * Must contain the "{version}" placeholder of the patch version number.
     */
    patchUrl: z.url().includes('{version}').optional(),

    /**
     * An URL pattern to fetch documents by ID.
     * Must contain "{id}" which will be replaced.
     */
    fetchDocumentUrl: z.url().includes('{id}').optional(),

    /**
     * Configuration for persisting and loading the search index to/from a local storage.
     */
    storageDriver: StorageDriverOptionsSchema.optional(),

    /**
     * A custom search index to initialize the instance.
     */
    searchIndex: SearchIndexSchema.optional(),
  })
  .refine(
    ({ keepDocuments, getDocumentById }) => !(keepDocuments && getDocumentById),
    {
      error: 'getDocumentById is not allowed when keepDocuments is true',
    },
  )
  .transform((opts) => {
    if (opts.language) {
      return {
        ...opts,
        tokenizer: PROCESSORS_BY_LANGUAGE[opts.language].tokenizer,
        analyzer: PROCESSORS_BY_LANGUAGE[opts.language].analyzer,
      };
    }
    return opts;
  });

export type Options<T extends Document> = z.input<typeof OptionsSchema> & {
  searchIndex?: SearchIndex<T>;
};
export type ParsedOptions<T extends Document> = z.output<
  typeof OptionsSchema
> & {
  searchIndex?: SearchIndex<T>;
};

export const QueryOptionsSchema = z.object({
  /**
   * Whether to include the documents in the search results.
   *
   * @default true
   */
  includeDocs: z.boolean().default(true),

  /**
   * The fields to search in. You can apply boosting to specific fields by using the syntax `fieldName^weight`. For example, `title^2` will boost the `title` field by a factor of 2. @default All fields
   */
  fields: z.array(z.string()).optional(),

  /**
   * The maximum number of results to return.
   */
  limit: z.number().positive().optional(),

  /**
   * The offset to start from (for pagination).
   *
   * @default 0
   */
  offset: z.number().nonnegative().default(0),

  /**
   * The BM25 parameters.
   */
  bm25: z
    .object({
      /**
       * The k1 parameter.
       *
       * @default 1.2
       */
      k1: z.number().default(1.2),

      /**
       * The b parameter.
       *
       * @default 0.75
       */
      b: z.number().default(0.75),
    })
    .default({ k1: 1.2, b: 0.75 }),

  /**
   * The fuzziness to use for fuzzy matching. Valid values are non-negative numbers or 'AUTO'. If set to a number, it will be used as the maximum edit distance allowed for fuzzy matching. If set to 'AUTO', the fuzziness will be calculated automatically based on the length of the query. @default 'AUTO'
   *
   * @default 'AUTO'
   */
  fuzziness: z
    .union([z.number().nonnegative(), z.literal('AUTO')])
    .default('AUTO'),

  /**
   * The maximum number of expansions to use for fuzzy matching. More expansions increase the number of possible words to match, thus a higher number will yield more results but also take longer.
   *
   * @default 5
   */
  maxExpansions: z.number().positive().default(5),

  /**
   * A function to get a document by its ID. This can be used when `keepDocuments` is false to load documents at dynamically. This overrides any `getDocumentById` passed to the constructor only for this query.
   */
  getDocumentById: z
    .function({
      input: [z.string()],
      // TODO: improve type
      output: z.promise(z.any().nullable()),
    })
    .optional(),

  /**
   * When fetching documents, ignore errors and return null instead
   */
  ignoreErrors: z.boolean().default(false),

  /**
   * The fields to highlight in the documents.
   */
  highlightedFields: z.array(z.string()).optional(),

  /**
   * The tags to use for highlighting.
   */
  highlightTag: z
    .object({
      /**
       * The tag to use before the highlighted text.
       *
       * @default '<b>'
       */
      before: z.string().default('<b>'),

      /**
       * The tag to use after the highlighted text.
       *
       * @default '</b>'
       */
      after: z.string().default('</b>'),
    })
    .default({ before: '<b>', after: '</b>' }),
});

export type QueryOptions = z.input<typeof QueryOptionsSchema>;
export type ParsedQueryOptions = z.output<typeof QueryOptionsSchema>;

export const SyncOptionsSchema = z.object({
  /**
   * The maximum number of version updates to apply.
   *
   * @default 1000
   */
  maxVersionUpdates: z.number().default(1000),

  /**
   * Whether to persist the index to the storage.
   * Nothing will be persisted to the storage, if false.
   *
   * @default true
   */
  persist: z.boolean().default(true),

  /**
   * Whether to run the sync in offline mode.
   * Nothing will be loaded from the remote storage, if true.
   *
   * @default false
   */
  offline: z.boolean().default(false),

  /**
   * Whether to run the sync in dry run mode.
   * If true, no changes will be applied or persisted, but
   * the result will contain the metadata about what would have been done.
   *
   * This expects the server to return a Content-Length header (might
   * require an appropriate Access-Control-Expose-Headers CORS policy, as well).
   *
   * @default false
   */
  dryRun: z.boolean().default(false),
});

export type SyncOptions = z.input<typeof SyncOptionsSchema>;
export type ParsedSyncOptions = z.output<typeof SyncOptionsSchema>;

export const AutocompleteOptionsSchema = z.object({
  /**
   * The method to use for autocomplete.
   */
  method: z.enum(['prefix', 'fuzzy']).default('prefix'),

  /**
   * The fuzziness to use for fuzzy matching. Only used if `method` is 'fuzzy'.
   *
   * If set to a number, it will be used as the maximum edit distance allowed for fuzzy matching.
   * If set to 'AUTO', the fuzziness will be calculated automatically based on the length of the query.
   *
   * @default 'AUTO'
   */
  fuzziness: z.union([z.number(), z.literal('AUTO')]).default('AUTO'),

  /**
   * The maximum number of results to return.
   */
  limit: z.number().positive().default(10),
});

export type AutocompleteOptions = z.input<typeof AutocompleteOptionsSchema>;
export type ParsedAutocompleteOptions = z.output<
  typeof AutocompleteOptionsSchema
>;

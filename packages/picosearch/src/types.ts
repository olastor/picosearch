import type { MinifiedNode, RadixBKTreeMap } from '@picosearch/radix-bk-tree';

export type TokenInfo = [
  internalDocumentId: number,
  fieldId: number,
  frequency: number,
];

export type RawTokenMarker = 1;

export interface SearchIndex<T extends PicosearchDocument> {
  // unique list of field names, the index will be used as field ID
  fields: string[];

  // list of document IDs as passed by the user, the index will be used as document reference ID for all internal operations to be space efficient
  originalDocumentIds: string[];

  // tree to lookup both token info for BM25 and raw words for fuzzy/prefix matches;
  // if a leaf is a raw token, it is marked by 1 in the first element of the node values
  termTree: RadixBKTreeMap<TokenInfo | RawTokenMarker>;

  // by document ID, get the (token-)length by the field ID
  docLengths: { [documentId: number]: { [fieldId: number]: number } };

  // by field ID get the total (token-)length (for this field) across all documents
  totalDocLengthsByFieldId: { [fieldId: number]: number };

  // by field ID get the number of documents with that field
  docCountsByFieldId: { [fieldId: number]: number };

  // the total number of documents
  docCount: number;

  // by document ID, get the document
  docsById: { [documentId: number]: T };
}

export type GetDocumentById<T extends PicosearchDocument> = (
  documentId: string,
) => Promise<T | null>;

export type PicosearchOptions<T extends PicosearchDocument> = {
  /**
   * The tokenizer to use for tokenizing documents.
   *
   * @default The default
   */
  tokenizer?: Tokenizer;

  /**
   * The analyzer to use for analyzing documents.
   *
   * @default The default analyzer
   */
  analyzer?: Analyzer;

  /**
   * Whether to keep the documents in the index. Not keeping documents in the index will save much space.
   *
   * @default false
   */
  keepDocuments?: boolean;

  /**
   * A function to get a document by its ID.
   * This can be used when `keepDocuments` is false to load documents at query time dynamically.
   *
   * @default undefined
   */
  getDocumentById?: GetDocumentById<T>;

  /**
   * The search index to use.
   *
   * @default A new search index
   */
  searchIndex?: SearchIndex<T>;

  /**
   * The field to use as document ID.
   *
   * @default 'id'
   */
  idField?: keyof T;

  /**
   * Whether to enable autocomplete feature. When turned on, the autocomplete() method
   * will be available, but the index will also be significantly larger as the raw words
   * need to be stored for fuzzy/prefix matching.
   *
   * @default false
   */
  enableAutocomplete?: boolean;
};

export type PicosearchDocument = Record<string, string>;

export type Preprocessor = (doc: string) => string[];

export type SearchResult = {
  id: string;
  score: number;
};

export type SearchResultWithDoc<T extends PicosearchDocument> = SearchResult & {
  doc: T;
};

export type QueryOptions<T extends PicosearchDocument> = {
  /**
   * Whether to include the documents in the search results.
   */
  includeDocs?: boolean;

  /**
   * The fields to search in.
   *
   * You can apply boosting to specific fields by using the syntax `fieldName^weight`. For example, `title^2` will boost the `title` field by a factor of 2.
   *
   * @default All fields
   */
  fields?: string[];

  /**
   * The maximum number of results to return.
   */
  limit?: number;

  /**
   * The offset to start from (for pagination).
   */
  offset?: number;

  /**
   * The BM25 parameters.
   */
  bm25?: { k1?: number; b?: number };

  /**
   * The fuzziness to use for fuzzy matching. Valid values are non-negative numbers or 'AUTO'.
   *
   * If set to a number, it will be used as the maximum edit distance allowed for fuzzy matching.
   * If set to 'AUTO', the fuzziness will be calculated automatically based on the length of the query.
   *
   * @default 'AUTO'
   */
  fuzziness?: number | 'AUTO';

  /**
   * The maximum number of expansions to use for fuzzy matching.
   * More expansions increase the number of possible words to match,
   * thus a higher number will yield more results but also take longer.
   */
  maxExpansions?: number;

  /**
   * A function to get a document by its ID. This can be used when `keepDocuments` is false to load documents at dynamically.
   * This overrides any `getDocumentById` passed to the constructor only for this query.
   */
  getDocumentById?: GetDocumentById<T>;
};

export type AutocompleteOptions = {
  /**
   * The method to use for autocomplete.
   */
  method: 'prefix' | 'fuzzy';

  /**
   * The fuzziness to use for fuzzy matching. Only used if `method` is 'fuzzy'.
   *
   * If set to a number, it will be used as the maximum edit distance allowed for fuzzy matching.
   * If set to 'AUTO', the fuzziness will be calculated automatically based on the length of the query.
   *
   * @default 'AUTO'
   */
  fuzziness?: number | 'AUTO';

  /**
   * The maximum number of results to return.
   */
  limit?: number;
};

export interface IPicosearch<T extends PicosearchDocument> {
  insertDocument: (document: T) => void;
  insertMultipleDocuments: (documents: T[]) => void;
  searchDocuments: {
    (
      query: string,
      options?: Omit<QueryOptions<T>, 'includeDocs'> & { includeDocs?: false },
    ): Promise<SearchResult[]>;
    (
      query: string,
      options: Omit<QueryOptions<T>, 'includeDocs'> & { includeDocs: true },
    ): Promise<SearchResultWithDoc<T>[]>;
  };
  autocomplete: (prefix: string, options?: AutocompleteOptions) => string[];
  toJSON: () => string;
}

export type Analyzer = (token: string) => string;
export type Tokenizer = (doc: string) => string[];

export type SerializedInstance<T extends PicosearchDocument> = {
  index: Omit<SearchIndex<T>, 'termTree'> & {
    termTree: MinifiedNode<RawTokenMarker | [number, number, number]>;
  };
  opts: Omit<PicosearchOptions<T>, 'tokenizer' | 'analyzer' | 'jsonIndex'>;
};

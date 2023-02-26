/** 
  * Options for defining preprocessing steps and parameters for scoring
  * that should be provided both at index and query time.
  */
export type TextAnalyzer = (token: string) => string
export type TextTokenizer = (text: string) => string[]

export interface TrieNode<T> {
  c: { [char: string]: TrieNode<T> }; // "children", saving some bytes by using "c"
  items: T[];
}

export interface QueryField {
  weight?: number,
  highlight?: boolean,
  snippet?: boolean
}

export interface QueryOptions {
  queryFields?: string[] | { [field: string]: QueryField };

  fuzziness: {
    maxError: number;
    prefixLength: number;
  };

  filter?: {
    [key: string]: any
  };

  size: number;

  offset: number;

  highlightTags: [string, string];

  getDocument?: (documentId: string | number) => Promise<{ [key: string]: any } | null> | null;
  
  /** Object for specifying custom BM25 parameters. */
  bm25: {
    /** 
      * The `b` value. 
      * @defaultValue 1.2
      */
    k1: number

    /** 
      * The `k1` value. 
      * @defaultValue 0.75
      */
    b: number
  }
}

/**
  * The search index returned after building the index and used for running search queries.
  * For normal use cases, the semantics of the fields of this data structure do not matter
  * to the user.
  */
export type TextFieldIndex = {
  /** 
    * A mapping of tokens to an array, in which the first value 
    * is the document ID this token is present and the second value
    * equals to the frequency of that token in the document.
    */
  docFreqsByToken: TrieNode<[number, number]>;

  /** A mapping for retrieving the length, i.e. the count of words, of a document by its ID. */
  docLengths: { [key: string]: number };

  /** The sum of lengths of all documents. */
  totalDocLengths: number;

  /** The count of documents. */
  docCount: number;
}

// [num, [docId2, docId2]]
export type NumberFieldIndex = [number, number[]][]
export type KeywordFieldIndex = TrieNode<number>;
export type MappingType = 'text' | 'keyword' | 'number' | 'date'

export interface SearchIndexMapping {
 [field: string]: MappingType 
}

export interface SearchIndex {
  length: number;
  mappings: SearchIndexMapping; 
  internalIds: {
    [originalId: string]: number
  },
  originalIds: {
    [internalId: string]: string | number
  },
  fields: {
    [key: string]: TextFieldIndex | NumberFieldIndex | KeywordFieldIndex
  }
}

export interface SearchResultsHit {
  _id: string | number;
  _score: number;
  _source?: { [key: string]: any } | null;
  highlight?: { [key: string]: string | string[] };
}

/** Data structure for a search result. */
export interface SearchResults {
  total: number;
  maxScore: number;
  hits: SearchResultsHit[];
}

export interface IndexField {
  indexDocument(fieldIndex: any, document: { [key: string]: unknown }, documentFieldValue: any): { [key: string]: any };
  removeDocument(fieldIndex: any, documentId: number): void;
  updateDocument(fieldIndex: any, document: { [key: string]: unknown }): void;
}

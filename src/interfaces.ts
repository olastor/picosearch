/** 
  * Options for defining preprocessing steps and parameters for scoring
  * that should be provided both at index and query time.
  */
export interface TextAnalyzer {
  /** 
    * A function to split a text into an array of tokens. 
    * @defaultValue `(s: string): string[] => s.split(/\s+/g)`
    */
  tokenizer: (s: string) => string[];
  
  /** 
    * A function for applying stemming on each token. 
    * @defaultValue null
    */
  stemmer: null | ((s: string) => string);
  
  /** 
    * Whether or not to lowercase tokens as part of preprocessing. 
    * @defaultValue true
    */
  lowercase: boolean;

  /** 
    * Whether or not to strip punctuations from tokens. 
    * @defaultValue true
    */
  stripPunctuation: boolean;

  /** 
    * A function to apply a custom transformation on each token before every other preprocessing step. 
    * @defaultValue null
    */
  customTransformation: null| ((s: string) => string);

  /** 
    * An array of lowercased words that should be ignored. 
    * @defaultValue []
    */
  stopwords: string[];
}

export interface TrieNode<T> {
  children: { [char: string]: TrieNode<T> };
  items: T[];
}

export interface QueryOptions {
  queryFields?: string[] | {
    weight?: number,
    b?: number,
    highlight?: boolean
  }[];

  fuzziness: {
    maxDistance: number;
    fixedPrefixLength: number;
  };

  filter?: {
    [key: string]: any
  };

  size: number;

  offset: number;

  highlightTags: {
    open: string;
    close: string;
  }

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

/**
  * The analyzer is a function for applying preprocessing steps, such as
  * stemming or lowercasing, to a single token.
  */
export type Analyzer = (token: string) => string

/**
  * The tokenizer is a function that splits a text into its tokens.
  */
export type Tokenizer = (text: string) => string[]

/**
  * The 'TrieNode' data structure is used to index text in a prefix-tree manner,
  * for more efficient storage usage and fuzzy-search algorithms with better a
  * better runtime than when using a simple map.
  */
export interface TrieNode<T> {
  /** Internal reference for the children of the current node. */
  _c: { [char: string]: TrieNode<T> };

  /** Internal reference for the data items of the current node. */
  _d: T[];
}

/**
  * Data structur for a range of integers with potentially missing numbers.
  */
export type CompactRange = {
  min: number,
  max: number,
  missing: number[]
}

/**
  * A query field describes options specific to one field
  * in the mapping when querying.
  */
export interface QueryField {
  /** The weight of this field. Values lower than 1 will decrease importance, values above 1 introduce a boosting. */
  weight?: number,
}

export interface QueryOptions {
  /** A list of text fields to use for searching or an object specifying more specific options for each field using the QueryField options. */
  queryFields?: string[] | { [field: string]: QueryField };

  /** Filters to exclude/include specific documents based on fields that are not of type 'text'. */
  filter?: {
    [field: string]: any;
  };

  /** The number of hits to return. */
  size: number;

  /** The number of hits to skip before returning, e.g. for doing pagination. */
  offset: number;

  /** A mapping of synonyms of analyzed tokens. */
  synonyms?: { [token: string]: string[] };

  getDocument?: (documentId: string) => Promise<{ [key: string]: any } | null> | null;

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

export interface Mappings {
 [field: string]: MappingType
}

export interface Index {
  length: number;
  mappings: Mappings;
  internalIds: CompactRange;
  originalIds: string[];
  fields: {
    [key: string]: TextFieldIndex | NumberFieldIndex | KeywordFieldIndex
  };
}

export interface SearchResultsHit {
  _id: string;
  _score: number;
  _source?: { [key: string]: any } | null;
}

/** Data structure for a search result. */
export interface SearchResults {
  total: number;
  maxScore: number;
  hits: SearchResultsHit[];
}

export interface IndexField {
  indexDocument(fieldIndex: any, document: { [key: string]: unknown }, documentFieldValue: any): { [key: string]: any };
}

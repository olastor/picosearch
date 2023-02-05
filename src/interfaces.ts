/** 
  * Options for defining preprocessing steps and parameters for scoring
  * that should be provided both at index and query time.
  */
export interface SearchOptions {
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
export interface SearchIndex {
  /** The total number of documents. */
  numOfDocs: number;

  /** 
    * A mapping of tokens to an array, in which the first value 
    * is the document ID this token is present and the second value
    * equals to the frequency of that token in the document.
    */
  docFreqsByToken: { [key: string]: [number, number][] };

  /** A mapping for retrieving the length, i.e. the count of words, of a document by its ID. */
  docLengths: { [key: string]: number };

  /** The average length of all documents. */
  avgDocLength: number;
}

/** Data structure for a search result. */
export interface SearchResult {
  /** The document ID, i.e., the array index in the document array used for index generation. */
  docId: number;

  /** 
    * A numeric score returned by the BM25 algorithm. A higher score means higher relevance.
    * Scores generally cannot be compared across different queries. 
    */
  score: number;
}
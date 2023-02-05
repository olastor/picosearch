import { SearchOptions } from './interfaces'

/** 
  * The default search options. See interface for documentation of default values.
  */
export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  tokenizer: (s: string): string[] => s.split(/\s+/g),
  stemmer: null,
  customTransformation: null,
  lowercase: true,
  stripPunctuation: true,
  stopwords: [],
  bm25: {
    k1: 1.2,
    b: 0.75
  }
}

import { 
  QueryOptions,
  TextAnalyzer,
  TextFieldIndex
} from './interfaces'

/** 
  * The default search options. See interface for documentation of default values.
  */
export const DEFAULT_ANALYZER: TextAnalyzer = {
  tokenizer: (s: string): string[] => s.split(/\s+/g),
  stemmer: null,
  customTransformation: null,
  lowercase: true,
  stripPunctuation: true,
  stopwords: []
}

export const DEFAULT_QUERY_OPTIONS: QueryOptions = {
  offset: 0,
  size: 10,
  bm25: {
    k1: 1.2,
    b: 0.75
  }
}

export const EMPTY_TEXT_FIELD_INDEX: TextFieldIndex = {
  docFreqsByToken: {},
  docLengths: {},
  totalDocLengths: 0,
  docCount: 0
}

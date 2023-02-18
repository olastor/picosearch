
import { 
  QueryOptions,
  TextAnalyzer,
  TextFieldIndex
} from './interfaces'

import KeywordField from './fields/keyword'
import NumberField from './fields/number'
import TextField from './fields/text'
import DateField from './fields/date'

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
  fuzziness: {
    maxDistance: 0,
    fixedPrefixLength: 0
  },
  highlightTags: {
    open: '<em>',
    close: '</em>'
  },
  bm25: {
    k1: 1.2,
    b: 0.75
  }
}

export const EMPTY_TEXT_FIELD_INDEX: TextFieldIndex = {
  docFreqsByToken: {
    children: {},
    items: []
  },
  docLengths: {},
  totalDocLengths: 0,
  docCount: 0
}

export const FIELD_CLASSES: { [key: string]: any } = {
  'keyword': KeywordField,
  'number': NumberField,
  'text': TextField,
  'date': DateField
}


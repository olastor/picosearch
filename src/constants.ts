
import { 
  QueryOptions,
  Analyzer,
  Tokenizer,
  TextFieldIndex
} from './interfaces'

import KeywordField from './fields/keyword'
import NumberField from './fields/number'
import TextField from './fields/text'
import DateField from './fields/date'

// eslint-disable-next-line
export const REGEXP_PATTERN_PUNCT = new RegExp("['!\"“”#$%&\\'()\*+,\-\.\/:;<=>?@\[\\\]\^_`{|}~']", 'g')

export const DEFAULT_TOKENIZER: Tokenizer = (text: string): string[] => {
  if (typeof text !== 'string') {
    return []
  }

  // eslint-disable-next-line
  const tokens: string[] = text.match(/\w+|\$[\d\.]+|\S+/g) || []
  return tokens
}
/** 
  * The default search options. See interface for documentation of default values.
  */
export const DEFAULT_ANALYZER: Analyzer = (token = '') => {
  return token.trim().replace(REGEXP_PATTERN_PUNCT, '').toLowerCase()
}

export const DEFAULT_QUERY_OPTIONS: QueryOptions = {
  offset: 0,
  size: 10,
  fuzziness: {
    maxError: 0,
    prefixLength: 0
  },
  highlightTags: ['<em>', '</em>'],
  snippetMinWindowSize: 17,
  bm25: {
    k1: 1.2,
    b: 0.75
  }
}

export const DEFAULT_FIELD_OPTIONS = {
  weight: 1,
  highlight: false,
  snippet: false
}

export const EMPTY_TEXT_FIELD_INDEX: TextFieldIndex = {
  docFreqsByToken: {
    _c: {}, 
    _d: []
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


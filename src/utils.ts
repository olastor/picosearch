import { SearchOptions } from './interfaces'
import { DEFAULT_SEARCH_OPTIONS } from './constants'

// eslint-disable-next-line no-useless-escape
const REGEXP_PATTERN_PUNCT = new RegExp("['!\"“”#$%&\\'()\*+,\-\.\/:;<=>?@\[\\\]\^_`{|}~']", 'g')
export const stripPunctuation = (s: string): string => s.replace(REGEXP_PATTERN_PUNCT, '')

export const checkSearchOptions = (options: SearchOptions): SearchOptions => {
  const optionsValid = {
    ...DEFAULT_SEARCH_OPTIONS,
    ...options
  } 

  return optionsValid
}

export const preprocessToken = (token: string, options: SearchOptions): string => {
  let newToken = token.trim()

  if (!newToken) return '';

  if (options.customTransformation) {
    newToken = options.customTransformation(newToken)
  }

  if (options.stripPunctuation) {
    newToken = stripPunctuation(newToken)
  }

  if (!newToken) return '';

  if (
    options.stopwords && 
    options.stopwords.length > 0 && 
    options.stopwords.includes(newToken.toLowerCase())
  ) {
    return ''
  }

  if (options.lowercase) {
    newToken = newToken.toLowerCase()
  }

  if (options.stemmer) {
    newToken = options.stemmer(newToken)
  }

  return newToken
}

export const preprocessText = (text: string, options: SearchOptions): string[] => {
  const tokens = options.tokenizer(text)
  const result: string[] = [] 

  for (const token of tokens) {
    const newToken = preprocessToken(token, options) 
    if (newToken) {
      result.push(newToken) 
    }
  }

  return result
}

export const findRemovedPartsByTokenizer = (doc: string, docTokens: string[]): string[] => {
  let currentIndex = 0

  const gaps = []
  docTokens.forEach(token => {
    const foundIndex = doc.indexOf(token, currentIndex)
    gaps.push(doc.slice(currentIndex, foundIndex))
    currentIndex = foundIndex + token.length
  })

  gaps.push(doc.slice(currentIndex, doc.length))

  return gaps
}

export const reconstructTokenizedDoc = (tokens: string[], gaps: string[]): string => {
  let doc = gaps[0]
  tokens.forEach((token, i) => {
    doc += token
    doc += gaps[i + 1]
  })
  return doc
}

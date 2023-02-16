import { TextAnalyzer } from '../interfaces'

// eslint-disable-next-line no-useless-escape
const REGEXP_PATTERN_PUNCT = new RegExp("['!\"“”#$%&\\'()\*+,\-\.\/:;<=>?@\[\\\]\^_`{|}~']", 'g')
export const stripPunctuation = (s: string): string => s.replace(REGEXP_PATTERN_PUNCT, '')

export const preprocessToken = (token: string, analyzer: TextAnalyzer): string => {
  let newToken = token.trim()

  if (!newToken) return '';

  if (analyzer.customTransformation) {
    newToken = analyzer.customTransformation(newToken)
  }

  if (analyzer.stripPunctuation) {
    newToken = stripPunctuation(newToken)
  }

  if (!newToken) return '';

  if (
    analyzer.stopwords && 
    analyzer.stopwords.length > 0 && 
    analyzer.stopwords.includes(newToken.toLowerCase())
  ) {
    return ''
  }

  if (analyzer.lowercase) {
    newToken = newToken.toLowerCase()
  }

  if (analyzer.stemmer) {
    newToken = analyzer.stemmer(newToken)
  }

  return newToken
}

export const preprocessText = (text: string, analyzer: TextAnalyzer): string[] => {
  const tokens = analyzer.tokenizer(text)
  const result: string[] = [] 

  for (const token of tokens) {
    const newToken = preprocessToken(token, analyzer) 
    if (newToken) {
      result.push(newToken) 
    }
  }

  return result
}

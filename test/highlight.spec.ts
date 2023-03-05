import { highlightText } from '../src/utils/highlight'
import { DEFAULT_TOKENIZER, REGEXP_PATTERN_PUNCT } from '../src/constants'

const porterStemmer = require('porter-stemmer')
const { eng } = require('stopword')

const analyzer = (token: string): string => {
  let newToken = token.trim().replace(REGEXP_PATTERN_PUNCT, '').toLowerCase()

  if (eng.includes(newToken)) {
    return ''
  }

  return porterStemmer.stemmer(newToken)
}

const preprocess = (s: string) => {
  return DEFAULT_TOKENIZER(s).map(analyzer).filter(s => s)
}

describe('highlight', () => {
  it('should return same text if no highlights', () => {
    expect(
      highlightText(
        preprocess('Where are my keys?'),
        'This is a document.',
        analyzer,
        DEFAULT_TOKENIZER
      )
    ).toEqual('This is a document.')
  })

  it('should highlighted text', () => {
    expect(
      highlightText(
        preprocess('Where are my keys?'),
        'The keys are where the key is, that is, in the key-place.',
        analyzer,
        DEFAULT_TOKENIZER
      )
    ).toEqual('The <b>keys</b> are where the <b>key</b> is, that is, in the <b>key</b>-place.')
  })
})

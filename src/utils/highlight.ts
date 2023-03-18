import {
  Analyzer,
  Tokenizer
} from '../interfaces'
import * as _ from './helper'

/**
 * Function highlighting matching words in documents for a query.
 *
 * @param query A word or sequence of words for searching the text corpus.
 * @param docs A set of documents to apply the highlighting to.
 * @param options The search options as provided to the function for querying.
 * @param tagBefore The opening tag for marking highlighted words.
 * @param tagAfter The closing tag for marking highlighted words.
 *
 * @returns The documents array with words highlighted that match the query.
 */
export const highlightText = (
  queryTokens: string[], 
  doc: string,
  analyzer: Analyzer,
  tokenizer: Tokenizer,
  tagBefore = '<b>',
  tagAfter = '</b>'
): string => {
  const docTokensRaw = tokenizer(doc)
  const docTokensAnalyzed = docTokensRaw
    .map(analyzer)

  const tokensToHighlight = [...new Set(_.intersection([docTokensAnalyzed, queryTokens]))]
  const tokensRawToHighlight = [...new Set(
    docTokensAnalyzed.map((token, i) => {
      const index = tokensToHighlight.indexOf(token)
      return index > -1 ? docTokensRaw[i] : ''
    }).filter(s => s)
  )].sort()

  if (tokensRawToHighlight.length === 0) {
    return doc
  }

  const reHighlight = new RegExp(`\\b(${tokensRawToHighlight.map(s => _.escapeRegExp(s)).join('|')})\\b`, 'g')
  return doc.replace(reHighlight, (word: string) => 
    `${tagBefore}${word}${tagAfter}`.replace(/\$/g, '$$$$')
  )
}

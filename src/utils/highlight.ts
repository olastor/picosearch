import {
  Analyzer,
  Tokenizer
} from '../interfaces'
import * as _ from './helper'

const indexOfAll = (haystack: string, needle: string) => {
  let start = 0
  let found = -1
  const result = []
  do {
    found = haystack.slice(start).indexOf(needle)
    if (found > -1) {
      result.push(start + found)
      start = start + found + needle.length
    }
  } while (found > -1)
  return result
}

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

  let highlighted = doc

  const tokensToHighlight = [...new Set(_.intersection([docTokensAnalyzed, queryTokens]))]
  const tokensRawToHighlight = [...new Set(
    docTokensAnalyzed.map((token, i) => {
      const index = tokensToHighlight.indexOf(token)
      return index > -1 ? docTokensRaw[i] : ''
    }).filter(s => s)
  )].sort((a, b) => b.length - a.length)


  // TODO: this could be optimized for better performance


  // find substrings among the raw tokens to highlight to make sure to
  // later always only replace the most commont "supertoken" if possible
  const substrings: { [key: string]: string[] } = {}
  tokensRawToHighlight.forEach((token, i) => 
    tokensRawToHighlight
      .slice(i + 1)
      .filter(token2 => token.indexOf(token2) > -1)
      .forEach(token2 => substrings[token] = [...(substrings[token] || []), token2])
  )

  // find occurrences of tokens in doc
  const replaceIndices: { [key: string]: number[] } = {}
  tokensRawToHighlight
    .forEach(token => replaceIndices[token] = [...(replaceIndices[token] || []), ...indexOfAll(doc, token)])

  // remove occurrences that have a supertoken
  Object.entries(substrings).forEach(([token, subTokens]) => subTokens.forEach(subToken => {
    const subTokenIndex = token.indexOf(subToken)
    replaceIndices[subToken] = (replaceIndices[subToken] || []).filter(i => 
      !replaceIndices[token].includes(i - subTokenIndex)
    )
  }))

  // wrap occurrences with tag
  Object.entries(replaceIndices)
    .flatMap(([token, indices]) => indices.map(i => ([token, i])))
    // sort reversed by index to start replacing in order that preserves indices of next replacements
    .sort((a: any, b: any) => b[1] - a[1]) 
    .forEach(([token, i]: any) => 
      highlighted = highlighted.slice(0, i) + tagBefore + token + tagAfter + highlighted.slice(i + token.length)
    )

  return highlighted
}

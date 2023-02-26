import {
  TextAnalyzer,
  TextTokenizer
} from '../interfaces'

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
  analyzer: TextAnalyzer,
  tokenizer: TextTokenizer,
  tagBefore = '<em>',
  tagAfter = '</em>'
): string => {
  const docTokensRaw = tokenizer(doc)
  const tokenizerGaps = findRemovedPartsByTokenizer(doc, docTokensRaw)
  const docTokensHighlighted = docTokensRaw.map(token => queryTokens.includes(analyzer(token))
    ? `${tagBefore}${token}${tagAfter}`
    : token
  )
  return reconstructTokenizedDoc(docTokensHighlighted, tokenizerGaps)
}

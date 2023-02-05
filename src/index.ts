import { 
  SearchOptions, 
  SearchResult,
  SearchIndex 
} from './interfaces'

import { DEFAULT_SEARCH_OPTIONS } from './constants'
import { 
  checkSearchOptions, 
  preprocessText, 
  preprocessToken,
  findRemovedPartsByTokenizer,
  reconstructTokenizedDoc
} from './utils'

export * from './constants'
export * from './interfaces'

/**
 * Function for building a search index that later can be used for querying.
 *
 * @param docs An array of documents / texts.
 * @param options The search options to use for pre-processing.
 *
 * @returns A JSON-serializable object containing the search index to be used for subsequent queries. The raw documents are **not included** in the index and the provided `docs` array must be present without modificaton at query time. Depending on the size of the text corpus, the size of the index can very.
 */
export const buildSearchIndex = (
  docs: string[], 
  options: SearchOptions = DEFAULT_SEARCH_OPTIONS
): SearchIndex => {
  const optionsValid = checkSearchOptions(options)

  const newIndex: SearchIndex = {
    numOfDocs: docs.length,
    docFreqsByToken: {},
    docLengths: {},
    avgDocLength: 0
  }

  // build a mapping, listing occurrences of a token in documents, grouped by the token
  const docsByToken: { [key: string]: number[] } = {}
  docs.forEach((text: string, i: number) => {
    const tokens = preprocessText(text, optionsValid)

    newIndex.docLengths[i.toString()] = tokens.length
    newIndex.avgDocLength += tokens.length

    tokens.forEach(token => {
      if (typeof docsByToken[token] === 'undefined') {
        docsByToken[token] = []
      }

      docsByToken[token].push(i)
    })
  })

  newIndex.avgDocLength /= docs.length

  // transform the mapping to include the frequencies of documents
  Object.entries(docsByToken).forEach(([token, docIds]) => {
    const freqMap: { [key: string]: number } = {};
    docIds.forEach((docId) => {
      freqMap[docId] = (freqMap[docId] || 0) + 1
    })

    newIndex.docFreqsByToken[token] = Object.entries(freqMap).map(([docId, freq]) => [Number(docId), freq])
  })
  
  return newIndex
}

/**
 * Function querying an existing search index.
 *
 * @param query A word or sequence of words for searching the text corpus.
 * @param index The search index build previously.
 * @param options The **exactly same** options as provided to the function for creating the index.
 * @param size The maximum amount of result items to return.
 * @param offset The offset for returning search items, e.g., for using pagination.
 *
 * @returns Returns an array of matches sorted by scores descending (starting with the most relevant item).
 */
export const querySearchIndex = (
  query: string, 
  index: SearchIndex, 
  options: SearchOptions = DEFAULT_SEARCH_OPTIONS, 
  size = 10,
  offset = 0
): SearchResult[] => {
  const optionsValid = checkSearchOptions(options)

  const queryTokens = preprocessText(query, optionsValid)

  if (queryTokens.length === 0) return []

  const docScores: { [doc: string]: number } = {}
  queryTokens.forEach(token => {
    if (!index.docFreqsByToken[token]) {
      return
    }

    index.docFreqsByToken[token].forEach(([docId, freq]) => {
      const idf = Math.log(
        1 + 
        (index.numOfDocs - index.docFreqsByToken[token].length + 0.5) /
        (index.docFreqsByToken[token].length + 0.5)
      )

      const score = idf * (
        (freq * (optionsValid.bm25.k1 + 1)) /
        (freq + optionsValid.bm25.k1 * (1 - optionsValid.bm25.b + optionsValid.bm25.b * (index.docLengths[docId] / index.avgDocLength)))
      )

      docScores[docId] = (docScores[docId] || 0) + score
    })
  })

  const ranked = Object.entries(docScores).sort((a, b) => b[1] - a[1])

  return ranked.slice(offset, size)
    .map(([docId, score]) => ({ docId: Number(docId), score }) as SearchResult)
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
export const highlightQueryInDocs = (
  query: string, 
  docs: string[],
  options: SearchOptions = DEFAULT_SEARCH_OPTIONS, 
  tagBefore = '<em>',
  tagAfter = '</em>'
) => {
  const optionsValid = checkSearchOptions(options)

  const queryTokens = preprocessText(query, optionsValid)
  const highlightedDocs = docs.map(doc => {
    const docTokensRaw = optionsValid.tokenizer(doc)
    const tokenizerGaps = findRemovedPartsByTokenizer(doc, docTokensRaw)
    const docTokensHighlighted = docTokensRaw.map(token => queryTokens.includes(preprocessToken(token, optionsValid))
      ? `${tagBefore}${token}${tagAfter}`
      : token
    )
    return reconstructTokenizedDoc(docTokensHighlighted, tokenizerGaps)
  })


  return highlightedDocs
}

export { DEFAULT_SEARCH_OPTIONS }

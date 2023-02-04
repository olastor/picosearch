import { 
  SearchOptions, 
  SearchResult,
  TextIndex 
} from './interfaces'

import { DEFAULT_SEARCH_OPTIONS } from './constants'
import { 
  checkSearchOptions, 
  preprocessText, 
  preprocessToken,
  findRemovedPartsByTokenizer,
  reconstructTokenizedDoc
} from './utils'

export const buildSearchIndex = (
  docs: string[], 
  options: SearchOptions = DEFAULT_SEARCH_OPTIONS
): TextIndex => {
  const optionsValid = checkSearchOptions(options)

  const newIndex: TextIndex = {
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

export const querySearchIndex = (
  query: string, 
  index: TextIndex, 
  options: SearchOptions = DEFAULT_SEARCH_OPTIONS, 
  size = 10
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

  return ranked.slice(0, size)
    .map(([docId, score]) => ({ docId: Number(docId), score }) as SearchResult)
}


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
    const docTokensRaw = options.tokenizer(doc)
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

import { SearchIndex, TextFieldIndex } from '../interfaces'
import { trieSearch } from './trie'

// https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/craswell_trec05.pdf
// https://arxiv.org/pdf/0911.5046.pdf
export const scoreBM25F = (
  queryTokens: string[],
  index: SearchIndex,
  fields: string[],
  weights: number[],
  b: number[],
  k1: number,
  documentIds: null | number[], 
): [number, number][] => {
  const docScores: { [doc: string]: number } = {}
  let pseudoFreqs: { [doc: string]: number } = {}

  for (const token of queryTokens) {
    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
      const field = fields[fieldIndex]
      const textIndex = index.fields[field] as TextFieldIndex

      const node = trieSearch(textIndex.docFreqsByToken, token)
      if (!node) {
        continue
      }

      const averageDocumentLength = documentIds === null 
        ? (textIndex.totalDocLengths / textIndex.docCount)
        : (
          documentIds
            .map(docId => textIndex.docLengths[docId])
            .reduce((partialSum, x) => partialSum + x, 0) /   
          documentIds.length
        )

      for (const [docId, freq] of node.items) {
        if (documentIds && !documentIds.includes(docId)) continue

        const normalizedTermFrequency = freq / (
          1 + 
          b[fieldIndex] * 
          ((textIndex.docLengths[docId] / averageDocumentLength) - 1)
        )
        pseudoFreqs[docId] = (pseudoFreqs[docId] || 0) + (weights[fieldIndex] * normalizedTermFrequency)
      }
    }

    const numberOfDocs = documentIds === null ? index.length : documentIds.length
    const documentFrequency = Object.keys(pseudoFreqs).length
    const idf = Math.log(
      1 + 
      (numberOfDocs - documentFrequency + 0.5) /
      (documentFrequency + 0.5)
    )

    for (const [docId, pseudoFreq] of Object.entries(pseudoFreqs)) {
      const termScore = (pseudoFreq / (k1 + pseudoFreq)) * idf
      docScores[docId] = (docScores[docId] || 0) + termScore
      pseudoFreqs[docId] = 0
    }
  }


  const ranked = Object.entries(docScores).sort((a, b) => b[1] - a[1])
    .map((x) => [Number(x[0]), x[1]] as [number, number]) 

  return ranked
}

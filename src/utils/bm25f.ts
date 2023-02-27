import { Index, QueryOptions, QueryField, TextFieldIndex } from '../interfaces'
import { trieSearch } from './trie'

/**
  * Calculates scores for documents matching the query tokens and returns a ranked list of most
  * relevant documents. The formula used is the simple BM25F version as specified in [1] and used
  * by Elasticsearch's "combined_field" query [2] for scoring across multiple field in the same index.
  *
  * [1] http://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf
  * [2] https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-combined-fields-query.html
  * [3] https://arxiv.org/pdf/0911.5046.pdf
  */
export const scoreBM25F = (
  queryTokens: string[],
  index: Index,
  validatedOptions: QueryOptions
): [number, number][] => {
  const docScores: { [doc: string]: number } = {}


  const queryFields: { [field: string]: QueryField } = validatedOptions.queryFields as { [field: string]: QueryField }
  const fields: string[] = Object.keys(queryFields)
  const k1 = validatedOptions.bm25.k1
  const b = validatedOptions.bm25.b

  // TODO: should those be adjusted when filtering? (potentially slow)
  const numberOfDocs = index.length
  const avgDl: number = fields
    .map(field => (index.fields[field] as TextFieldIndex).totalDocLengths / numberOfDocs)
    .reduce((acc, x) => acc + x, 0)

  for (const token of queryTokens) {
    const dlTilde: { [doc: string]: number } = {}
    const tfTilde: { [doc: string]: number } = {}

    const docIds = new Set<number>()
    let df = 0
    fields.forEach(field => {
      const textIndex = index.fields[field] as TextFieldIndex
      const node = trieSearch(textIndex.docFreqsByToken, token)
      if (!node) {
        return
      }

      node._d.forEach(([docId, freq]: [number, number]) => {
        docIds.add(docId)
        tfTilde[docId] = (tfTilde[docId] || 0) + (queryFields[field].weight || 1) * freq
        dlTilde[docId] = (dlTilde[docId] || 0) + textIndex.docLengths[docId]
        df++
      })
    })

    for (const docId of docIds) {
      const idf = Math.log(
        1 +
        (numberOfDocs - df + 0.5) / 
        (df + 0.5)
      )

      const score = (tfTilde[docId] / (tfTilde[docId] + k1 * (1 - b + b * dlTilde[docId] / avgDl))) * idf

      docScores[docId] = (docScores[docId] || 0) + score
    }
  }

  const ranked = Object.entries(docScores).sort((a, b) => b[1] - a[1])
    .map((x) => [Number(x[0]), x[1]] as [number, number]) 

  return ranked
}

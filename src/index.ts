import { 
  SearchResults,
  SearchIndex,
  SearchIndexMapping,
  TextFieldIndex,
  NumberFieldIndex,
  KeywordFieldIndex,
  TextAnalyzer,
  QueryOptions,
  SearchResultsHit
} from './interfaces'

import { DEFAULT_ANALYZER, DEFAULT_QUERY_OPTIONS } from './constants'

import { scoreBM25F } from './utils/bm25f'

export * from './constants'
export * from './interfaces'

import * as _ from './utils/helper'

import KeywordField from './fields/keyword'
import NumberField from './fields/number'
import TextField from './fields/text'

import { evaluateFilter } from './utils/filter'
import { preprocessText, preprocessToken } from './utils/preprocessing'
import { trieFuzzySearch } from './utils/trie'
import { findRemovedPartsByTokenizer, reconstructTokenizedDoc } from './utils/highlight'



/**
 * Function for building a search index that later can be used for querying.
 *
 * @param docs An array of documents / texts.
 * @param options The search options to use for pre-processing.
 *
 * @returns A JSON-serializable object containing the search index to be used for subsequent queries. The raw documents are **not included** in the index and the provided `docs` array must be present without modificaton at query time. Depending on the size of the text corpus, the size of the index can very.
 */
export const createIndex = (mappings: SearchIndexMapping): SearchIndex => {
  const index: SearchIndex = {
    length: 0,
    mappings,
    fields: {},
    internalIds: {},
    originalIds: {}
  }

  return index
}

export const indexDocument = (
  index: SearchIndex,
  doc: { [key: string]: any },
  analyzerP: Partial<TextAnalyzer> = DEFAULT_ANALYZER
) => {
  const analyzer: TextAnalyzer = {
    ...DEFAULT_ANALYZER,
    ...analyzerP
  }

  if (!(
    typeof doc._id === 'string' && doc._id.length > 0 ||
    typeof doc._id === 'number'
  )) {
    throw new Error('Missing id')
  }

  if (typeof index.internalIds[doc._id] !== 'undefined') {
    throw new Error('Duplicate ID')
  }
  // const analyzer = checkSearchOptions(analyzer)

  let internalId
  do {
    internalId = _.randomInt()
  } while (index.internalIds[internalId])

  index.internalIds[doc._id] = internalId
  index.originalIds[internalId] = doc._id

  index.length += 1

  for (const [field, value] of Object.entries(doc)) {
    if (field === '_id') continue

    const type = index.mappings[field]      

    if (type === 'text') {
      if (!index.fields[field]) {
        index.fields[field] = TextField.initialize()
      }

      TextField.indexDocument(
        index.fields[field] as TextFieldIndex,
        internalId,
        value,
        analyzer
      )
    } else if (type === 'keyword') {
      if (!index.fields[field]) {
        index.fields[field] = KeywordField.initialize()
      }

      KeywordField.indexDocument(
        index.fields[field] as KeywordFieldIndex,
        internalId,
        value
      )
    } else if (type === 'number') {
      if (!index.fields[field]) {
        index.fields[field] = NumberField.initialize()
      }

      NumberField.indexDocument(
        index.fields[field] as NumberFieldIndex,
        internalId,
        value
      )
    } else {
      throw new Error('invalid field')
    }
  }
}

export const removeDocument = (
  index: SearchIndex,
  doc: { [key: string]: any }
) => {
  const internalId = index.internalIds[doc._id]
  if (internalId === undefined) {
    throw new Error('Document does not exist.')
  }

  // TODO: delete from fields

  delete index.internalIds[doc._id]
  delete index.originalIds[internalId]

  index.length -= 1
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
export const searchIndex = async (
  index: SearchIndex,
  query: string,
  optionsP: Partial<QueryOptions>,
  analyzerP: Partial<TextAnalyzer> = DEFAULT_ANALYZER
): Promise<SearchResults> => {
  // const analyzer = checkSearchOptions(options)
  const analyzer: TextAnalyzer = {
    ...DEFAULT_ANALYZER,
    ...analyzerP
  }

  const options: QueryOptions = {
    ...DEFAULT_QUERY_OPTIONS,
    ...optionsP
  }

  let filteredDocumentIds: number[]
  if (options.filter) {
    filteredDocumentIds = evaluateFilter(index, options.filter)
  }

  let highlightedFields: string[] = []
  if (query) {
    let textFields: string[] = []
    let b: number[] = []
    let weights: number[] = []

    if (Array.isArray(options.queryFields) && options.queryFields.length > 0) {
      (options.queryFields as string[]).forEach((field => {
        if (!index.mappings[field]) {
          throw new Error('Field does not exist.')
        }

        textFields.push(field)
        b.push(options.bm25.b)
        weights.push(1)
      }))
    } else if (typeof options.queryFields === 'object') {
      Object.entries(options.queryFields).forEach(([field, fieldOpts]) => {
        if (typeof fieldOpts['b'] === 'number') {
          b.push(fieldOpts['b'])
        } else {
          b.push(options.bm25.b)
        }

        if (typeof fieldOpts['weight'] === 'number') {
          weights.push(fieldOpts['weight'])
        } else {
          weights.push(1)
        }

        if (fieldOpts['highlight'] === true) {
          highlightedFields.push(field)
        }

        textFields.push(field)
      })
    } else {
      textFields = Object.entries(index.mappings)
        .filter(([field, type]) => type === 'text')
        .map(([field]) => field)
      b = textFields.map(() => options.bm25.b)
      weights = textFields.map(() => 1)
    }


    let queryTokens = preprocessText(query, analyzer)

    if (options.fuzziness.maxDistance) {
      const originalTokens = [...queryTokens]
      for (const token of originalTokens) {
        for (const field of textFields) {
          console.log(
            options.fuzziness.maxDistance,
            options.fuzziness.fixedPrefixLength || 0
          )
          trieFuzzySearch<[number, number]>(
            (index.fields[field] as TextFieldIndex).docFreqsByToken, 
            token,
            options.fuzziness.maxDistance,
            options.fuzziness.fixedPrefixLength || 0
          ).forEach(([fuzzyToken]) => {
            if (!queryTokens.includes(fuzzyToken)) {
              queryTokens.push(fuzzyToken)
            }
          })
        }
      }
    }

    if (queryTokens.length === 0) {
      return {
        total: 0,
        maxScore: 0,
        hits: []
      }
    }

    const ranked = scoreBM25F(
      queryTokens,
      index,
      textFields,
      weights,
      b,
      options.bm25.k1,
      null
    )

    const hits = []

    for (const [docId, _score] of ranked.slice(options.offset, options.size)) {
      let _source: any = null
      let highlight: { [key: string]: string } = {}
      if (options.getDocument) {
        _source = await options.getDocument(index.originalIds[docId])
      }

      const hit: SearchResultsHit = {
        _id: index.originalIds[docId],
        _score,
        _source
      }

      if (_source && highlightedFields.length > 0) {
        highlightedFields.forEach(field => {
          const text = _.get(_source, field)
          const tokensRaw = analyzer.tokenizer(text)
          const tokenizerGaps = findRemovedPartsByTokenizer(text, tokensRaw)
          const tokensHighlighted = tokensRaw.map(token => 
            queryTokens.includes(preprocessToken(token, analyzer))
              ? `${options.highlightTags.open}${token}${options.highlightTags.close}`
              : token)
          
          highlight[field] = reconstructTokenizedDoc(
            tokensHighlighted, 
            tokenizerGaps
          )
        })

        hit.highlight = highlight
      }

      hits.push(hit)
    }

    return {
      total: ranked.length,
      maxScore: hits.length > 0 ? hits[0]._score : 0,
      hits
    }
  }  

  return {
    total: 0,
    maxScore: 0,
    hits: []
  }
}

export { DEFAULT_QUERY_OPTIONS, DEFAULT_ANALYZER }

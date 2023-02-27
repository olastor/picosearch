import { 
  SearchResults,
  SearchIndex,
  SearchIndexMapping,
  TextFieldIndex,
  NumberFieldIndex,
  KeywordFieldIndex,
  TextAnalyzer,
  TextTokenizer,
  QueryOptions,
  SearchResultsHit,
  QueryField
} from './interfaces'

import { DEFAULT_ANALYZER, DEFAULT_TOKENIZER, DEFAULT_QUERY_OPTIONS } from './constants'

import { scoreBM25F } from './utils/bm25f'
import { preprocessText } from './utils/preprocessing'

export * from './constants'
export * from './interfaces'

import * as _ from './utils/helper'

import KeywordField from './fields/keyword'
import NumberField from './fields/number'
import TextField from './fields/text'

import { evaluateFilter } from './utils/filter'
import { trieFuzzySearch } from './utils/trie'
import { highlightText } from './utils/highlight'
import { validateOptions } from './utils/options'



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
  analyzer: TextAnalyzer = DEFAULT_ANALYZER,
  tokenizer: TextTokenizer = DEFAULT_TOKENIZER
) => {
  if (!(
    typeof doc._id === 'string' && doc._id.length > 0 ||
    typeof doc._id === 'number'
  )) {
    throw new Error('Missing id')
  }

  if (typeof index.internalIds[doc._id] !== 'undefined') {
    throw new Error('Duplicate ID')
  }

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
        analyzer,
        tokenizer
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
  options: Partial<QueryOptions>,
  analyzer: TextAnalyzer = DEFAULT_ANALYZER,
  tokenizer: TextTokenizer = DEFAULT_TOKENIZER
): Promise<SearchResults> => {
  // const analyzer = checkSearchOptions(options)
  const optionsValid: QueryOptions = validateOptions(index, options)

  let filteredDocumentIds: number[] | null = null
  if (optionsValid.filter) {
    filteredDocumentIds = evaluateFilter(index, optionsValid.filter)
  }

  const highlightedFields: string[] = Object.entries(optionsValid.queryFields as { [key: string]: QueryField })
    .filter(([field, opts]) => opts.highlight)
    .map(([field]) => field)

  if (query) {
    const queryTokens = preprocessText(query, analyzer, tokenizer)
    const textFields = Object.keys(optionsValid.queryFields as QueryField)

    if (optionsValid.fuzziness.maxError) {
      const originalTokens = [...queryTokens]

      // enrich query tokens with tokens from the search index
      // that are similar within the defined error boundary. 
      for (const token of originalTokens) {
        for (const field of textFields) {
          trieFuzzySearch<[number, number]>(
            (index.fields[field] as TextFieldIndex).docFreqsByToken, 
            token,
            optionsValid.fuzziness.maxError,
            optionsValid.fuzziness.prefixLength || 0
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

    let ranked = scoreBM25F(
      queryTokens,
      index,
      optionsValid
    )

    if (filteredDocumentIds) {
      // TODO: O(1) map?
      ranked = ranked.filter(([docId]) => (filteredDocumentIds as number[]).includes(docId))
    }

    const hits = []

    for (const [docId, _score] of ranked.slice(optionsValid.offset, optionsValid.offset + optionsValid.size)) {
      let _source: any = null
      const highlight: { [key: string]: string | string[] } = {}

      if (optionsValid.getDocument) {
        _source = await optionsValid.getDocument(index.originalIds[docId])
      }

      const hit: SearchResultsHit = {
        _id: index.originalIds[docId],
        _score,
        _source
      }

      if (_source && highlightedFields.length > 0) {
        highlightedFields.forEach(field => {
          const text = _.get(_source, field)
          highlight[field] = Array.isArray(text)
            ? text.map(t => highlightText(
              queryTokens, 
              t, 
              analyzer, 
              tokenizer,
              optionsValid.highlightTags[0],
              optionsValid.highlightTags[1],
            ))
              : highlightText(
                queryTokens,
                text,
              analyzer, 
              tokenizer,
              optionsValid.highlightTags[0],
              optionsValid.highlightTags[1],
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

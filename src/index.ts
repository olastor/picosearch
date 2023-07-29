import {
  SearchResults,
  Index,
  Mappings,
  TextFieldIndex,
  NumberFieldIndex,
  KeywordFieldIndex,
  Analyzer,
  Tokenizer,
  QueryOptions,
  SearchResultsHit
} from './interfaces'

import {
  DEFAULT_ANALYZER,
  DEFAULT_TOKENIZER,
  DEFAULT_QUERY_OPTIONS
} from './constants'

import { scoreBM25F } from './utils/bm25f'
import { preprocessText } from './utils/preprocessing'

export * from './constants'
export * from './interfaces'

import * as _ from './utils/helper'

import KeywordField from './fields/keyword'
import NumberField from './fields/number'
import TextField from './fields/text'

import { evaluateFilter } from './utils/filter'
import { validateOptions } from './utils/options'
import { validateMappings } from './utils/mappings'

const getOriginalIdByInternalId = (index: Index, internalId: number): string =>
  index.originalIds[internalId - index.internalIds.missing.filter((x: number) => x < internalId).length]

/**
 * Function for building a search index that later can be used for querying.
 *
 * @param docs An array of documents / texts.
 * @param options The search options to use for pre-processing.
 *
 * @returns A JSON-serializable object containing the search index to be used for subsequent queries. The raw documents are **not included** in the index and the provided `docs` array must be present without modificaton at query time. Depending on the size of the text corpus, the size of the index can very.
 */
export const createIndex = (mappings: Mappings): Index => {
  const index: Index = {
    length: 0,
    mappings: validateMappings(mappings),
    fields: {},
    internalIds: { min: 0, max: -1, missing: [] },
    originalIds: []
  }

  return index
}

export const indexDocument = (
  index: Index,
  doc: { [key: string]: any },
  analyzer: Analyzer = DEFAULT_ANALYZER,
  tokenizer: Tokenizer = DEFAULT_TOKENIZER
) => {
  if (!(
    typeof doc._id === 'string' && doc._id.length > 0 ||
    typeof doc._id === 'number'
  )) {
    throw new Error('Missing id')
  }

  if (typeof index.originalIds[doc._id as any] !== 'undefined') {
    throw new Error('Duplicate ID')
  }

  if (!index.originalIds) {
    index.originalIds = []
  }

  index.originalIds.push(String(doc._id))
  index.internalIds.max++
  index.length++

  const internalId = index.internalIds.max

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
  index: Index,
  query: string,
  options: Partial<QueryOptions>,
  analyzer: Analyzer = DEFAULT_ANALYZER,
  tokenizer: Tokenizer = DEFAULT_TOKENIZER
): Promise<SearchResults> => {
  // const analyzer = checkSearchOptions(options)
  const optionsValid: QueryOptions = validateOptions(index, options)

  let filteredDocumentIds: number[] | null = null
  if (optionsValid.filter) {
    filteredDocumentIds = evaluateFilter(index, optionsValid.filter)
  }

  if (query) {
    let queryTokens = preprocessText(query, analyzer, tokenizer)

    if (queryTokens.length === 0) {
      return {
        total: 0,
        maxScore: 0,
        hits: []
      }
    }

    if (optionsValid.synonyms) {
      queryTokens = [
        ...queryTokens,
        ...Object.entries(optionsValid.synonyms)
          .filter(([token]) => queryTokens.includes(token))
          .flatMap(([token, syns]) => syns)
      ]
    }

    queryTokens = [...new Set(queryTokens)]

    let ranked = scoreBM25F(
      queryTokens,
      index,
      optionsValid
    )

    if (filteredDocumentIds) {
      // TODO: O(1) map?
      ranked = ranked.filter(([docId]) => (filteredDocumentIds as number[]).includes(docId))
    }

    const hits: SearchResultsHit[] = []

    const sourcePromises = []

    if (optionsValid.getDocument) {
      for (const [docId] of ranked.slice(optionsValid.offset, optionsValid.offset + optionsValid.size)) {
        const originalId = getOriginalIdByInternalId(index, docId)
        sourcePromises.push(optionsValid.getDocument(originalId))
      }
    }

    const sources = await Promise.all(sourcePromises)

    let i = 0
    for (const [docId, _score] of ranked.slice(optionsValid.offset, optionsValid.offset + optionsValid.size)) {
      const _source: any = optionsValid.getDocument ? sources[i] : null
      const _id = getOriginalIdByInternalId(index, docId)
      const hit: SearchResultsHit = {
        _id,
        _score,
        _source
      }

      hits.push(hit)
      i++
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

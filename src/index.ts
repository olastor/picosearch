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
  SearchResultsHit,
  QueryField
} from './interfaces'

import { 
  DEFAULT_ANALYZER, 
  DEFAULT_TOKENIZER, 
  DEFAULT_QUERY_OPTIONS,
  FIELD_CLASSES
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
import { trieFuzzySearch } from './utils/trie'
import { highlightText } from './utils/highlight'
import { snippet } from './utils/snippet'
import { validateOptions } from './utils/options'
import { validateMappings } from './utils/mappings'

const getOriginalIdByInternalId = (index: Index, internalId: number): string => 
  index.originalIds[internalId - index.internalIds.missing.filter((x: number) => x < internalId).length]

const getInternalIdByOriginalId = (index: Index, originalId: string): number => {
  const i = index.originalIds.indexOf(originalId)
  if (i === -1) {
    throw new Error('ID not found: ' + originalId)
  }

  return i + index.internalIds.missing.filter((x: number) => x < i).length
}
  

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

export const removeDocument = (
  index: Index,
  doc: { [key: string]: any }
) => {
  const internalId = getInternalIdByOriginalId(index, String(doc._id))

  if (internalId === undefined) {
    throw new Error('Document does not exist.')
  }

  for (const [field, type] of Object.entries(index.mappings)) {
    FIELD_CLASSES[type].removeDocument(index.fields[field])
  }

  index.internalIds.missing.push(internalId)
  delete index.originalIds[index.originalIds.indexOf(String(doc._id))]
  index.length--
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

  const highlightedFields: string[] = Object.entries(optionsValid.queryFields as { [key: string]: QueryField })
    .filter(([field, opts]) => opts.highlight)
    .map(([field]) => field)

  const snippetFields: string[] = Object.entries(optionsValid.queryFields as { [key: string]: QueryField })
    .filter(([field, opts]) => opts.snippet)
    .map(([field]) => field)

  if (query) {
    let queryTokens = preprocessText(query, analyzer, tokenizer)
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

    if (optionsValid.synonyms) {
      queryTokens = [
        ...queryTokens,
        ...Object.entries(optionsValid.synonyms)
          .filter(([token]) => queryTokens.includes(token))
          .flatMap(([token, syns]) => syns)
      ]
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
      const highlight: { [key: string]: string | string[] } = {}

      const _id = getOriginalIdByInternalId(index, docId)
      const hit: SearchResultsHit = {
        _id,
        _score,
        _source
      }

      if (_source && (highlightedFields.length > 0 || snippetFields.length > 0)) {
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

        if (highlightedFields.length > 0) {
          hit.highlight = highlight
        }

        if (snippetFields.length > 0) {
          hit.snippets = {}
          for (const [field, hled] of Object.entries(highlight)) {
            if (Array.isArray(hled)) {
              hit.snippets[field] = hled.map(hl => snippet(
                hl,
                optionsValid.highlightTags[0],
                optionsValid.highlightTags[1],
                optionsValid.snippetMinWindowSize
              ))
            } else {
              hit.snippets[field] = snippet(
                hled,
                optionsValid.highlightTags[0],
                optionsValid.highlightTags[1],
                optionsValid.snippetMinWindowSize
              )
            }
          }
        }
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

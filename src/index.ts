import { 
  SearchResult,
  SearchIndex,
  SearchIndexMapping,
  TextFieldIndex,
  NumberFieldIndex,
  KeywordFieldIndex,
  TextAnalyzer,
  QueryOptions
} from './interfaces'

import { DEFAULT_ANALYZER, DEFAULT_QUERY_OPTIONS } from './constants'

import { scoreBM25F } from './utils/bm25f'

export * from './constants'
export * from './interfaces'

import {KeywordField} from './fields/keyword'
import {NumberField} from './fields/number'
import {TextField} from './fields/text'
import { evaluateFilter } from './utils/filter'
import { preprocessText } from './utils/preprocessing'



/**
 * Function for building a search index that later can be used for querying.
 *
 * @param docs An array of documents / texts.
 * @param options The search options to use for pre-processing.
 *
 * @returns A JSON-serializable object containing the search index to be used for subsequent queries. The raw documents are **not included** in the index and the provided `docs` array must be present without modificaton at query time. Depending on the size of the text corpus, the size of the index can very.
 */
export const createIndex = (mappings: SearchIndexMapping): SearchIndex => {
  const searchIndex: SearchIndex = {
    length: 0,
    mappings,
    fields: {},
    ids: {},
    lastId: -1
  }


  return searchIndex
}

export const indexDocument = (
  searchIndex: SearchIndex,
  doc: { [key: string]: any },
  analyzer: TextAnalyzer = DEFAULT_ANALYZER
) => {
  analyzer = {
    ...DEFAULT_ANALYZER,
    ...analyzer
  }

  if (!doc._id && doc._id !== 0) {
    throw new Error('Missing id')
  }

  if (typeof searchIndex.ids[doc._id] !== 'undefined') {
    throw new Error('Duplicate ID')
  }

  // const analyzer = checkSearchOptions(analyzer)

  // TODO: handle integer passing MAX_SAFE_INTEGER
  const numericId = searchIndex.lastId + 1

  searchIndex.ids[doc._id] = numericId
  searchIndex.lastId = numericId
  searchIndex.length += 1

  for (const [field, value] of Object.entries(doc)) {
    if (field === '_id') continue

    const type = searchIndex.mappings[field]      

    if (type === 'text') {
      if (!searchIndex.fields[field]) {
        searchIndex.fields[field] = TextField.initialize()
      }

      TextField.indexDocument(
        searchIndex.fields[field] as TextFieldIndex,
        numericId,
        value,
        analyzer
      )
    } else if (type === 'keyword') {
      if (!searchIndex.fields[field]) {
        searchIndex.fields[field] = KeywordField.initialize()
      }

      KeywordField.indexDocument(
        searchIndex.fields[field] as KeywordFieldIndex,
        numericId,
        value
      )
    } else if (type === 'number') {
      if (!searchIndex.fields[field]) {
        searchIndex.fields[field] = NumberField.initialize()
      }

      NumberField.indexDocument(
        searchIndex.fields[field] as NumberFieldIndex,
        numericId,
        value
      )
    } else {
      throw new Error('invalid field')
    }
  }
}

export const removeDocument = (
  searchIndex: SearchIndex,
  doc: { [key: string]: any }
) => {
  const numericId = searchIndex.ids[doc._id]
  if (numericId === undefined) {
    throw new Error('Document does not exist.')
  }

  delete searchIndex.ids[doc._id]
  searchIndex.lastId = numericId
  searchIndex.length -= 1
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
export const searchIndex = (
  query: string,
  index: SearchIndex,
  optionsP: Partial<QueryOptions>,
  analyzerP: Partial<TextAnalyzer> = DEFAULT_ANALYZER
): any => {
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

        // TODO: highlight
      })
    } else {
      textFields = Object.entries(index.mappings)
        .filter(([field, type]) => type === 'text')
        .map(([field]) => field)
      b = textFields.map(() => options.bm25.b)
      weights = textFields.map(() => 1)
    }


    const queryTokens = preprocessText(query as any, analyzer)
    if (queryTokens.length === 0) return []

    const ranked = scoreBM25F(
      queryTokens,
      index,
      textFields,
      weights,
      b,
      options.bm25.k1,
      null
    )

    return ranked.slice(options.offset, options.size)
      .map(([docId, score]) => ({ docId: Number(docId), score }) as SearchResult)
  }  
}

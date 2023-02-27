import { DEFAULT_QUERY_OPTIONS, DEFAULT_FIELD_OPTIONS } from '../constants'
import { 
  Index, 
  QueryOptions,
  Mappings
} from '../interfaces'

export const validateOptions = (
  index: Index,
  options: Partial<QueryOptions>
): QueryOptions => {
  if (!options) {
    return DEFAULT_QUERY_OPTIONS
  }

  const { 
    offset, 
    size, 
    fuzziness, 
    queryFields, 
    getDocument, 
    bm25,
    highlightTags,
    filter,
    ...otherProps
  } = options

  const validatedOptions: QueryOptions = { 
    ...DEFAULT_QUERY_OPTIONS
  }

  if (Object.keys(otherProps).length > 0) {
    throw new Error(`Encountered unknown options: ${Object.keys(otherProps).join(', ')}`)
  }

  if (filter) {
    // TODO: validate more
    validatedOptions.filter = filter
  }

  if (typeof size !== 'undefined' && (typeof size !== 'number' || size < 0)) {
    throw new Error('Option "size" must be a non-negative integer.')
  }
  
  if (typeof size !== 'undefined') {
    validatedOptions.size = size
  }

  if (typeof offset !== 'undefined' && (typeof offset !== 'number' || offset < 0)) {
    throw new Error('Option "offset" must be a non-negative integer.')
  }

  if (typeof offset !== 'undefined') {
    validatedOptions.offset = offset
  }

  if (fuzziness) {
    const { maxError, prefixLength } = fuzziness

    if (typeof maxError === 'undefined') {
      fuzziness.maxError = DEFAULT_QUERY_OPTIONS.fuzziness.maxError
    } else if (typeof maxError !== 'number' || maxError < 0) {
      throw new Error('Option "fuzziness.maxError" must be a non-negative integer.')
    }

    if (typeof prefixLength === 'undefined') {
      fuzziness.prefixLength = DEFAULT_QUERY_OPTIONS.fuzziness.prefixLength
    } else if (typeof prefixLength !== 'number' || prefixLength < 0) {
      throw new Error('Option "fuzziness.prefixLength" must be a non-negative integer.')
    }

    validatedOptions.fuzziness = { ...fuzziness }
  }

  if (bm25) {
    if (typeof bm25 !== 'object') {
      throw new Error('Option "bm25" must be an object.')
    }

    const { b, k1, ...otherBm25Opts } = bm25

    if (Object.keys(otherProps).length > 0) {
      throw new Error(`Encountered unknown BM25 options: ${Object.keys(otherBm25Opts).join(', ')}`)
    }

    if (typeof b !== 'undefined' && (typeof b !== 'number' || b < 0 || b > 1)) {
      throw new Error('Option "bm25.b" must be a number between 0 and 1.')
    }

    if (typeof k1 !== 'undefined' && (typeof k1 !== 'number' || k1 < 0)) {
      throw new Error('Option "bm25.k1" must be a non-negative number.')
    }

    validatedOptions.bm25 = {
      ...DEFAULT_QUERY_OPTIONS.bm25,
      ...bm25
    }
  }

  if (highlightTags) {
    if (!Array.isArray(highlightTags) || highlightTags.length !== 2 || highlightTags.find(x => typeof x !== 'string')) {
      throw new Error('Option "highlightTags" must an array with exactly two string items.')
    }

    validatedOptions.highlightTags = highlightTags
  }

  if (Array.isArray(queryFields)) {
    if ((queryFields as any[]).find((item: any) => typeof item !== 'string')) {
      throw new Error('Option "queryFields" must be an array of strings or an object.')
    }

    const unknownField = (queryFields as string[]).find(field => index.mappings[field] !== 'text')
    if (unknownField) {
      throw new Error(`Option "queryFields" contains unknown text field "${unknownField}".`)
    }

    validatedOptions.queryFields = (queryFields as string[])
      .reduce(
        (acc, field) => {
          acc[field] = { ...DEFAULT_FIELD_OPTIONS }
          return acc
        }, 
        {} as { [key: string]: any }
      )
  } else if (typeof queryFields === 'object') {
    Object.entries(queryFields as object).forEach(([field, fieldOpts]: [string, any]) => {
      if (index.mappings[field] !== 'text') {
        throw new Error(`Option "queryFields" contains unknown text field "${field}".`)
      }

      if (typeof fieldOpts !== 'object') {
        throw new Error(`Option "queryFields.${field}" must be an object.`)
      }

      const { highlight, snippet, weight, ...otherFieldOpts } = fieldOpts

      if (typeof highlight !== 'undefined' && typeof highlight !== 'boolean') {
        throw new Error(`Option "queryFields.${field}.highlight must be a boolean if specified."`)
      }

      if (typeof snippet !== 'undefined' && typeof snippet !== 'boolean') {
        throw new Error(`Option "queryFields.${field}.snippet must be a boolean if specified."`)
      }

      if (typeof weight !== 'undefined' && (typeof weight !== 'number' || weight < 0)) {
        throw new Error(`Option "queryFields.${field}.weight must be a non-negative number if specified."`)
      }

      if (Object.keys(otherFieldOpts).length > 0) {
        throw new Error(`Encountered invalid options for field ${field}: ${Object.keys(otherFieldOpts).join(', ')}`) 
      }

      validatedOptions.queryFields = {
        ...validatedOptions.queryFields,
        [field]: {
          ...DEFAULT_QUERY_OPTIONS,
          ...fieldOpts
        }
      } as {
        [field: string]: {
          weight?: number,
          highlight?: boolean,
          snippet?: boolean
        }
      } 
    })
  } else if (!queryFields) {
    validatedOptions.queryFields = Object.entries(index.mappings)
      .filter(([field, type]) => type === 'text')
      .reduce(
        (acc, [field]) => {
          acc[field] = { ...DEFAULT_FIELD_OPTIONS }
          return acc
        }, 
        {} as { [key: string]: any }
      )
  } else {
    throw new Error('Invalid option "queryFields".')
  }

  if (typeof getDocument !== 'undefined' && typeof getDocument !== 'function') {
    throw new Error('Option "getDocument" must be a function if specified.')
  }

  
  if (typeof getDocument !== 'undefined') {
    validatedOptions.getDocument = getDocument
  }

  return validatedOptions
}

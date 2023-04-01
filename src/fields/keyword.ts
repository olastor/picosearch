import { IndexField, KeywordFieldIndex } from '../interfaces'
import { trieInsert, trieSearch, trieDelete, trieFuzzySearch } from '../utils/trie'

export default class KeywordField  {
  public static initialize(): KeywordFieldIndex {
    return { _c: {}, _d: [] }
  }

  public static indexDocument(
    fieldIndex: KeywordFieldIndex,
    documentId: number,
    documentFieldValue: string | string[]
  ): void {
    if (Array.isArray(documentFieldValue)) {
      [...new Set(documentFieldValue)].forEach(val => this.indexDocument(fieldIndex, documentId, val))
      return
    }

    trieInsert<number>(fieldIndex, documentId, documentFieldValue.split(''))
  }

  public static removeDocument(
    fieldIndex: KeywordFieldIndex,
    documentId: number
  ): void {
    trieDelete(fieldIndex, documentId)
  }

  public static updateDocument(
    fieldIndex: KeywordFieldIndex,
    documentId: number,
    documentFieldValue: string | string[]
  ): void {
    this.removeDocument(fieldIndex, documentId)
    this.indexDocument(fieldIndex, documentId, documentFieldValue)
  }

  public static filterDocuments(
    fieldIndex: KeywordFieldIndex,
    filter: string | string[]
  ): number[] {
    if (Array.isArray(filter)) {
      const invalidArrayItem = filter.find(item => typeof item !== 'string')
      if (invalidArrayItem) {
        throw new Error(`Invalid value '${invalidArrayItem}' provided for filtering the '${fieldIndex}' field.`)
      }

      return [...new Set((filter as string[])
        .flatMap(keyword => KeywordField.filterDocuments(fieldIndex, keyword)))]
    } else if (typeof filter === 'string') {
      const node = trieSearch<number>(fieldIndex, filter.split(''))
      return node ? node._d : []
    } else {
      throw new Error(`Invalid value '${filter}' provided for filtering the field.`)
    }
  }
}


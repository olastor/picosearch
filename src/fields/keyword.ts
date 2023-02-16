import { IndexField, KeywordFieldIndex } from '../interfaces'

export class KeywordField  {
  public static initialize(): KeywordFieldIndex {
    return {}
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

    if (typeof fieldIndex[documentFieldValue] === 'undefined') {
      fieldIndex[documentFieldValue] = [documentId]
    } else {
      fieldIndex[documentFieldValue].push(documentId)
    }
  }

  // slow
  public static removeDocument(
    fieldIndex: KeywordFieldIndex,
    documentId: number
  ): void {
    for (const key of Object.keys(fieldIndex)) {
      const foundIndex = fieldIndex[key].findIndex(x => x === documentId)
      if (foundIndex) {
        fieldIndex[key].splice(foundIndex, 1) 
      }

      if (fieldIndex[key].length === 0) {
        delete fieldIndex[key]
      }
    }
  }

  public static updateDocument(
    fieldIndex: KeywordFieldIndex,
    documentId: number,
    documentFieldValue: string | string[]
  ): void {
    this.removeDocument(fieldIndex, documentId)
    this.indexDocument(fieldIndex, documentId, documentFieldValue)
  }
}


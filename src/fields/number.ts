import { IndexField, NumberFieldIndex } from '../interfaces'
import { binarySearch } from '../utils/binary-search'

export class NumberField {
  public static initialize() {
    return [] 
  }

  public static indexDocument(
    fieldIndex: NumberFieldIndex,
    documentId: number,
    documentFieldValue: number | number[]
  ): void {
    if (Array.isArray(documentFieldValue)) {
      [...new Set(documentFieldValue)].forEach(val => NumberField.indexDocument(fieldIndex, documentId, val))      
      return
    }

    const insertionIndex = binarySearch(
      documentFieldValue, 
      fieldIndex,
      true,
      (item: [number, number[]]) => item[0]
    )

    if (
      fieldIndex.length > 0 && 
      insertionIndex < fieldIndex.length &&
      fieldIndex[insertionIndex][0] === documentFieldValue
    ) {
      fieldIndex[insertionIndex][1].push(documentId)
    } else {
      fieldIndex.splice(insertionIndex, 1, [documentFieldValue, [documentId]])
    }
  }

  public static removeDocument(
    fieldIndex: NumberFieldIndex,
    documentId: number
  ): void {
    let toDelete: number[] = []

    fieldIndex.forEach(([value, docIds], i) => {
      const foundIndex = docIds.findIndex(x => x === documentId)
      if (foundIndex !== -1) {
        docIds.splice(foundIndex, 1)
        if (docIds.length === 0) {
          toDelete.push(i)
        }
      }
    })

    toDelete.reverse().forEach(i => fieldIndex.splice(i, 1))
  }

  public static updateDocument(
    fieldIndex: NumberFieldIndex,
    documentId: number,
    documentFieldValue: number | number[]
  ): void {
    NumberField.removeDocument(fieldIndex, documentId)
    NumberField.indexDocument(fieldIndex, documentId, documentFieldValue)
  }
}

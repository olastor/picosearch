import { IndexField, NumberFieldIndex } from '../interfaces'
import { binarySearch } from '../utils/binary-search'

export default class NumberField {
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
      fieldIndex.splice(insertionIndex, 0, [documentFieldValue, [documentId]])
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

  public static filterDocuments(
    fieldIndex: NumberFieldIndex,
    filter: any
  ): number[] {
    if (Array.isArray(filter)) {
      const invalidArrayItem = filter.find(item => typeof item !== 'number')
      if (invalidArrayItem) {
        throw new Error(`Invalid value '${invalidArrayItem}' provided for filtering number field.`)
      }

      return [...new Set((filter as number[]).flatMap(num => NumberField.filterDocuments(fieldIndex, num)))]
    }

    if (typeof filter === 'number') {
      const foundIndex = binarySearch(
        filter,
        fieldIndex,
        false,
        ([value]) => value
      )

      return foundIndex === -1 ? [] : fieldIndex[foundIndex][1]
    }

    if (typeof filter === 'object') {
      const { $gt, $gte, $lt, $lte, $ne, ...otherParams } = filter
      if (otherParams) {
        throw new Error('Invalid params')
      }
    
      if (typeof $ne === 'number') {
        return [...new Set(fieldIndex.filter(([val]) => val !== $ne).flatMap(([val, docIds]) => docIds))]
      }

      let minIndex = 0
      let maxIndex = fieldIndex.length - 1

      if (typeof $gt === 'number') {
        minIndex = binarySearch(
          $gt,
          fieldIndex,
          true,
          ([value]) => value
        )
        minIndex = fieldIndex[minIndex][0] === $gt ? minIndex + 1 : minIndex
      }

      if (typeof $gte === 'number') {
        minIndex = binarySearch(
          $gte,
          fieldIndex,
          true,
          ([value]) => value
        )
        minIndex = fieldIndex[minIndex][0] === $gt ? minIndex : minIndex - 1
      }

      if (typeof $lt === 'number') {
        maxIndex = binarySearch(
          $lt,
          fieldIndex,
          true,
          ([value]) => value
        )
        maxIndex = fieldIndex[maxIndex][0] === $lt ? maxIndex - 1 : maxIndex
      }

      if (typeof $lte === 'number') {
        maxIndex = binarySearch(
          $lte,
          fieldIndex,
          true,
          ([value]) => value
        )
        maxIndex = fieldIndex[maxIndex][0] === $lte ? maxIndex : maxIndex + 1
      }

      if (minIndex > maxIndex) {
        throw new Error('Invalid range filter')
      }

      return [...(new Set(fieldIndex.slice(minIndex, maxIndex).flatMap((x) => x[1])))]
    }

    throw new Error('Invalid filter provided')
  }

}

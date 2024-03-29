import { NumberFieldIndex } from '../interfaces'
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

      if (Object.keys(otherParams).length > 0) {
        throw new Error(`Unknown number filter options specified: ${otherParams.join(', ')}.`)
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
        if (minIndex > fieldIndex.length - 1) return []
        minIndex = fieldIndex[minIndex][0] <= $gt ? minIndex + 1 : minIndex
      }

      if (typeof $gte === 'number') {
        minIndex = binarySearch(
          $gte,
          fieldIndex,
          true,
          ([value]) => value
        )
        if (minIndex > fieldIndex.length - 1) return []
        minIndex = fieldIndex[minIndex][0] < $gte ? minIndex + 1 : minIndex
      }

      if (typeof $lt === 'number') {
        maxIndex = binarySearch(
          $lt,
          fieldIndex,
          true,
          ([value]) => value
        )

        if (maxIndex < fieldIndex.length && fieldIndex[maxIndex][0] >= $lt) {
          maxIndex = maxIndex - 1
        }
      }

      if (typeof $lte === 'number') {
        maxIndex = binarySearch(
          $lte,
          fieldIndex,
          true,
          ([value]) => value
        )
        if (maxIndex < fieldIndex.length && fieldIndex[maxIndex][0] > $lte) {
          maxIndex = maxIndex - 1
        }
      }

      if (minIndex > maxIndex) {
        return []
      }

      return [...(new Set(fieldIndex.slice(minIndex, maxIndex + 1).flatMap((x) => x[1])))]
    }

    throw new Error('Invalid filter provided')
  }

}

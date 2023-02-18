import { NumberFieldIndex } from '../interfaces'
import NumberField from './number'

export default class DateField {
  public static initialize() {
    return [] 
  }

  public static indexDocument(
    fieldIndex: NumberFieldIndex,
    documentId: number,
    documentFieldValue: string | Date
  ): void {
    if (documentFieldValue instanceof Date) {
      return NumberField.indexDocument(fieldIndex, documentId, Number(documentFieldValue))
    } else if (typeof documentFieldValue === 'string') {
      return NumberField.indexDocument(fieldIndex, documentId, Date.parse(documentFieldValue))
    }
  }

  public static removeDocument(
    fieldIndex: NumberFieldIndex,
    documentId: number
  ): void {
    NumberField.removeDocument(fieldIndex, documentId)
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
    if (filter instanceof Date) {
      return NumberField.filterDocuments(fieldIndex, Number(filter))
    } else if (typeof filter === 'string') {
      return NumberField.filterDocuments(fieldIndex, Date.parse(filter))
    }

    throw new Error('Invalid filter')
  }

}

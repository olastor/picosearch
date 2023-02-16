import {
  TextAnalyzer,
  TextFieldIndex
} from '../interfaces'

import { preprocessText } from '../utils/preprocessing'

export class TextField  {
  public static initialize() {
    return  {
      docFreqsByToken: {},
      docLengths: {},
      totalDocLengths: 0,
      docCount: 0
    }
  }

  public static indexDocument(
    fieldIndex: TextFieldIndex,
    documentId: number,
    documentFieldValue: string,
    analyzer: TextAnalyzer
  ): void {
    if (typeof documentFieldValue !== 'string') {
      throw new Error('Text must be a string!')
    }

    const tokens = preprocessText(documentFieldValue, analyzer)

    const tokenFreqs: { [key: string]: number } = {}
    tokens.forEach((token: string) => {
      tokenFreqs[token] = (tokenFreqs[token] || 0) + 1
    })
    
    Object.entries(tokenFreqs).forEach(([token, freq]) => {
      if (typeof fieldIndex.docFreqsByToken[token] === 'undefined') {
        fieldIndex.docFreqsByToken[token] = []
      }

      fieldIndex.docFreqsByToken[token].push([documentId, freq])
    })

    fieldIndex.docLengths[documentId.toString()] = tokens.length
    fieldIndex.totalDocLengths += tokens.length
    fieldIndex.docCount += 1
  }

  // slow
  public static removeDocument(
    fieldIndex: TextFieldIndex,
    documentId: number
  ): void {
    Object.entries(fieldIndex.docFreqsByToken).forEach(([token, values]) => {
      const index = values.findIndex(item => item[0] === documentId)
      if (index > -1) {
        values.splice(index, 1)
      }
    })

    fieldIndex.totalDocLengths -= fieldIndex.docLengths[documentId.toString()]
    delete fieldIndex.docLengths[documentId.toString()]
    fieldIndex.docCount -= 1
  }

  // public static updateDocument(
  //   fieldIndex: TextFieldIndex,
  //   options: SearchOptions,
  //   documentId: number,
  //   documentFieldValue: string
  // ): void {
  //   this.removeDocument(fieldIndex, documentId)
  //   this.indexDocument(fieldIndex, options, documentId, documentFieldValue)
  // }
}

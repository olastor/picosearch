import {
  TextAnalyzer,
  TextTokenizer
} from '../interfaces'

export const preprocessText = (text: string, analyzer: TextAnalyzer, tokenizer: TextTokenizer): string[] => {
  return tokenizer(text)
    .map(analyzer)
    .filter(t => t)
}

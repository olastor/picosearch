import {
  Analyzer,
  Tokenizer
} from '../interfaces'

export const preprocessText = (text: string, analyzer: Analyzer, tokenizer: Tokenizer): string[] => {
  return tokenizer(text)
    .map(analyzer)
    .filter(t => t)
}

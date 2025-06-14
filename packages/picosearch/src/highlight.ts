import type { Analyzer, Tokenizer } from './types';

/**
 * Function highlighting matching words in documents for a query.
 *
 * @param query A word or sequence of words for searching the text corpus.
 * @param docs A set of documents to apply the highlighting to.
 * @param options The search options as provided to the function for querying.
 * @param tagBefore The opening tag for marking highlighted words.
 * @param tagAfter The closing tag for marking highlighted words.
 *
 * @returns The documents array with words highlighted that match the query.
 */
export const highlightText = (
  queryTokens: Set<string>,
  doc: string,
  analyzer: Analyzer,
  tokenizer: Tokenizer,
  tagBefore = '<b>',
  tagAfter = '</b>',
): string => {
  const rawTokensToHighlight = new Set<string>();
  const rawDocTokens = tokenizer(doc);
  for (const rawDocToken of rawDocTokens) {
    const docToken = analyzer(rawDocToken);
    if (docToken && queryTokens.has(docToken))
      rawTokensToHighlight.add(rawDocToken);
  }

  const isMatch = (word: string, position: number): boolean => {
    for (let i = 0; i < word.length; i++) {
      if (doc[position + i] !== word[i]) return false;
    }
    return true;
  };

  let result = '';
  let k = 0;
  for (let i = 0; i < doc.length; i++) {
    const word = rawDocTokens[k];
    if (isMatch(word, i)) {
      result += rawTokensToHighlight.has(word)
        ? `${tagBefore}${word}${tagAfter}`
        : word;

      i += word.length - 1;
      k++;

      if (k >= rawDocTokens.length) {
        result += doc.slice(i + 1);
        break;
      }
      continue;
    }

    // fill up the space the tokenizer removed
    result += doc[i];
  }

  return result;
};

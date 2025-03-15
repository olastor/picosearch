import porterStemmer from 'porter-stemmer';
import { eng } from 'stopword';

const REGEXP_PATTERN_PUNCT = /['!\"“”#$%&\'()*+,-.\/:;<=>?@[\]\^_`{|}~']/g;

export const tokenizer = (doc: string): string[] => {
  if (typeof doc !== 'string') {
    return [];
  }

  return doc.match(/\w+/g) || [];
};

export const analyzer = (token: string): string => {
  const newToken = token.trim().replace(REGEXP_PATTERN_PUNCT, '').toLowerCase();

  if (eng.includes(newToken)) {
    return '';
  }

  return porterStemmer.stemmer(newToken);
};

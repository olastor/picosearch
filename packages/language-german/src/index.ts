import { deu } from 'stopword';
import { stem } from './cistem';

export const tokenizer = (doc: string): string[] => {
  if (typeof doc !== 'string') {
    return [];
  }

  return doc.match(/\w+/g) || [];
};

const REGEXP_PATTERN_PUNCT = /['!\"“”#$%&\'()*+,-.\/:;<=>?@[\]\^_`{|}~']/g;

export const analyzer = (token: string): string => {
  const newToken = token.trim().replace(REGEXP_PATTERN_PUNCT, '').toLowerCase();

  if (deu.includes(newToken)) {
    return '';
  }

  return stem(newToken);
};

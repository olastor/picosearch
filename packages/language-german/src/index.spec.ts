import { describe, expect, it } from 'vitest';
import { analyzer, tokenizer } from './index';
describe('tokenizer', () => {
  it('should tokenize a string into words', () => {
    expect(tokenizer('Hallo, Welt!')).toEqual(['Hallo', 'Welt']);
  });

  it('should return an empty array for non-string input', () => {
    expect(tokenizer(undefined as any)).toEqual([]);
    expect(tokenizer(123 as any)).toEqual([]);
  });

  it('should return an empty array for an empty string', () => {
    expect(tokenizer('')).toEqual([]);
  });
});

describe('analyzer', () => {
  it('should remove punctuation and convert to lower case', () => {
    expect(analyzer('Häuser,')).toEqual('hau');
  });

  it('should return an empty string for stopwords', () => {
    expect(analyzer('der')).toEqual('');
    expect(analyzer('und')).toEqual('');
  });

  it('should apply stemming correctly', () => {
    expect(analyzer('Laufend')).toEqual('lauf');
    expect(analyzer('Läufer')).toEqual('lauf');
  });
});

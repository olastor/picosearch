import { describe, expect, it } from 'vitest';
import { analyzer, tokenizer } from './index';

describe('tokenizer', () => {
  it('should tokenize a string into words', () => {
    expect(tokenizer('Hello, world!')).toEqual(['Hello', 'world']);
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
    expect(analyzer('Houses,')).toEqual('hous');
  });

  it('should return an empty string for stopwords', () => {
    expect(analyzer('the')).toEqual('');
    expect(analyzer('and')).toEqual('');
  });

  it('should apply stemming correctly', () => {
    expect(analyzer('running')).toEqual('run');
    expect(analyzer('runners')).toEqual('runner');
  });
});

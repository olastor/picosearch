import { describe, expect, it } from 'vitest';
import { parseFieldNameAndWeight } from './util';

describe('parseFieldNameAndWeight', () => {
  it('should parse field name and weight correctly', () => {
    const result = parseFieldNameAndWeight('field^2.5');
    expect(result).toEqual(['field', 2.5]);
  });

  it('should interpret the field without weight as weight 1', () => {
    const result = parseFieldNameAndWeight('field');
    expect(result).toEqual(['field', 1]);
  });

  it('should parse field name with integer weight correctly', () => {
    const result = parseFieldNameAndWeight('field^3');
    expect(result).toEqual(['field', 3]);
  });
});

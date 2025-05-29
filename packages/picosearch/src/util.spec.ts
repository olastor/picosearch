import { describe, expect, it } from 'vitest';
import {
  getJsonKeyReplacer,
  getJsonKeyReviver,
  parseFieldNameAndWeight,
} from './util';

describe('getJsonKeyReplacer', () => {
  it('should replace keys based on the mapping provided', () => {
    const keyMapping = { oldKey: 'newKey' };
    const replacer = getJsonKeyReplacer(keyMapping);
    const result = replacer('key', { oldKey: 'value' });
    expect(result).toEqual({ newKey: 'value' });
  });

  it('should not replace keys with no mapping', () => {
    const keyMapping = { oldKey: 'newKey' };
    const replacer = getJsonKeyReplacer(keyMapping);
    const result = replacer('key', { anotherKey: 'value' });
    expect(result).toEqual({ anotherKey: 'value' });
  });

  it('should return value if it is not an object', () => {
    const keyMapping = { oldKey: 'newKey' };
    const replacer = getJsonKeyReplacer(keyMapping);
    expect(replacer('key', 'value')).toBe('value');
  });
});

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

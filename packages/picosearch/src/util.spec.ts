import { describe, expect, it } from 'vitest';
import { flatten, omit, parseFieldNameAndWeight } from './util';

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

describe('flatten', () => {
  it('should handle primitive values', () => {
    const obj = {
      str: 'hello',
      num: 42,
      bool: true,
      nullVal: null,
      undefinedVal: undefined,
    };

    const result = flatten(obj);

    expect(result).toEqual({
      str: 'hello',
      num: 42,
      bool: true,
      nullVal: null,
      undefinedVal: undefined,
    });
  });

  it('should flatten nested objects with dot notation', () => {
    const obj = {
      user: {
        name: 'John',
        profile: {
          age: 30,
          city: 'New York',
        },
      },
    };

    const result = flatten(obj);

    expect(result).toEqual({
      'user.name': 'John',
      'user.profile.age': 30,
      'user.profile.city': 'New York',
    });
  });

  it('should flatten arrays by index', () => {
    const obj = {
      tags: ['javascript', 'typescript', 'node'],
      numbers: [1, 2, 3],
    };

    const result = flatten(obj);

    expect(result).toEqual({
      'tags.0': 'javascript',
      'tags.1': 'typescript',
      'tags.2': 'node',
      'numbers.0': 1,
      'numbers.1': 2,
      'numbers.2': 3,
    });
  });

  it('should handle objects with toJSON method', () => {
    const objWithToJSON = {
      toJSON() {
        return 'serialized';
      },
    };

    const obj = {
      convertible: objWithToJSON,
      regular: 'value',
    };

    const result = flatten(obj);

    expect(result).toEqual({
      convertible: objWithToJSON,
      regular: 'value',
    });
  });

  it('should handle complex mixed nested structures', () => {
    const obj = {
      metadata: {
        title: 'Document',
        tags: ['important', 'draft'],
        author: {
          name: 'Jane',
          contact: {
            email: 'jane@example.com',
            phone: null,
          },
        },
      },
      content: 'Some content',
      settings: {
        enabled: true,
        options: [1, 2, 3],
      },
    };

    const result = flatten(obj);

    expect(result).toEqual({
      'metadata.title': 'Document',
      'metadata.tags.0': 'important',
      'metadata.tags.1': 'draft',
      'metadata.author.name': 'Jane',
      'metadata.author.contact.email': 'jane@example.com',
      'metadata.author.contact.phone': null,
      content: 'Some content',
      'settings.enabled': true,
      'settings.options.0': 1,
      'settings.options.1': 2,
      'settings.options.2': 3,
    });
  });

  it('should handle empty objects', () => {
    const obj = {};

    const result = flatten(obj);

    expect(result).toEqual({});
  });

  it('should handle objects with empty nested objects', () => {
    const obj = {
      empty: {},
      notEmpty: {
        value: 'test',
      },
    };

    const result = flatten(obj);

    // TODO: consider if this behaviour should be changed
    expect(result).toEqual({
      'notEmpty.value': 'test',
    });
  });

  it('should handle arrays with nested objects', () => {
    const obj = {
      items: [
        { name: 'item1', value: 10 },
        { name: 'item2', value: 20 },
      ],
    };

    const result = flatten(obj);

    expect(result).toEqual({
      'items.0.name': 'item1',
      'items.0.value': 10,
      'items.1.name': 'item2',
      'items.1.value': 20,
    });
  });

  it('should handle deeply nested structures', () => {
    const obj = {
      level1: {
        level2: {
          level3: {
            level4: {
              value: 'deep',
            },
          },
        },
      },
    };

    const result = flatten(obj);

    expect(result).toEqual({
      'level1.level2.level3.level4.value': 'deep',
    });
  });
});

describe('omit', () => {
  it('should omit specified keys from object', () => {
    const obj = {
      name: 'John',
      age: 30,
      city: 'New York',
      country: 'USA',
    };

    const result = omit(obj, ['age', 'country']);

    expect(result).toEqual({
      name: 'John',
      city: 'New York',
    });
  });

  it('should return empty object when input is null or undefined', () => {
    // biome-ignore lint/suspicious/noExplicitAny: Testing edge case with invalid input
    expect(omit(null as any, ['key'])).toEqual({});
    // biome-ignore lint/suspicious/noExplicitAny: Testing edge case with invalid input
    expect(omit(undefined as any, ['key'])).toEqual({});
  });

  it('should return original object when keys array is empty', () => {
    const obj = {
      name: 'John',
      age: 30,
    };

    const result = omit(obj, []);

    expect(result).toEqual(obj);
    expect(result).toBe(obj); // Should be the same reference
  });

  it('should return original object when keys array is null or undefined', () => {
    const obj = {
      name: 'John',
      age: 30,
    };

    // biome-ignore lint/suspicious/noExplicitAny: Testing edge case with invalid input
    const result1 = omit(obj, null as any);
    // biome-ignore lint/suspicious/noExplicitAny: Testing edge case with invalid input
    const result2 = omit(obj, undefined as any);

    expect(result1).toEqual(obj);
    expect(result1).toBe(obj);
    expect(result2).toEqual(obj);
    expect(result2).toBe(obj);
  });

  it('should handle omitting non-existent keys', () => {
    const obj = {
      name: 'John',
      age: 30,
    };

    // biome-ignore lint/suspicious/noExplicitAny: Testing with non-existent keys
    const result = omit(obj, ['nonExistent', 'alsoNonExistent'] as any);

    expect(result).toEqual({
      name: 'John',
      age: 30,
    });
  });

  it('should handle omitting all keys', () => {
    const obj = {
      name: 'John',
      age: 30,
    };

    const result = omit(obj, ['name', 'age']);

    expect(result).toEqual({});
  });

  it('should work with objects containing different value types', () => {
    const obj = {
      str: 'string',
      num: 42,
      bool: true,
      nullVal: null,
      undefinedVal: undefined,
      arr: [1, 2, 3],
      nested: { key: 'value' },
    };

    const result = omit(obj, ['num', 'nullVal', 'arr']);

    expect(result).toEqual({
      str: 'string',
      bool: true,
      undefinedVal: undefined,
      nested: { key: 'value' },
    });
  });

  // TODO: consider supporting these two cases if needed
  // it('should preserve object prototype and methods', () => {
  //   class TestClass {
  //     name = 'test';
  //     age = 25;

  //     getName() {
  //       return this.name;
  //     }
  //   }

  //   const obj = new TestClass();
  //   const result = omit(obj, ['age']);

  //   expect(result).toEqual({
  //     name: 'test',
  //     getName: obj.getName,
  //   });
  //   expect(result.getName).toBe(obj.getName);
  // });

  // it('should handle objects with symbol keys', () => {
  //   const sym1 = Symbol('sym1');
  //   const sym2 = Symbol('sym2');

  //   const obj = {
  //     name: 'John',
  //     [sym1]: 'symbol1',
  //     [sym2]: 'symbol2',
  //   };

  //   const result = omit(obj, ['name']);

  //   expect(result).toEqual({
  //     [sym1]: 'symbol1',
  //     [sym2]: 'symbol2',
  //   });
  // });

  it('should work with readonly keys array', () => {
    const obj = {
      name: 'John',
      age: 30,
      city: 'New York',
    } as const;

    const keysToOmit = ['age'] as const;
    const result = omit(obj, keysToOmit);

    expect(result).toEqual({
      name: 'John',
      city: 'New York',
    });
  });

  it('should handle empty object', () => {
    const obj = {};

    // biome-ignore lint/suspicious/noExplicitAny: Testing with non-existent keys on empty object
    const result = omit(obj, ['nonExistent'] as any);

    expect(result).toEqual({});
  });
});

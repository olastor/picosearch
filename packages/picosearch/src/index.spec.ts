import { beforeEach, describe, expect, test } from 'vitest';
import { Picosearch } from './index';
import type {
  IPicosearch,
  PicosearchDocument,
  QueryOptions,
  SearchResult,
} from './interfaces';

describe('Picosearch', () => {
  let searchIndex: IPicosearch<PicosearchDocument>;

  beforeEach(() => {
    searchIndex = new Picosearch();
  });

  test('insertDocument throws error when id is missing', () => {
    expect(() => searchIndex.insertDocument({} as PicosearchDocument)).toThrow(
      "The document's required 'id' field is missing or not a string.",
    );
  });

  test('insertDocument successfully adds a document', () => {
    const document = { id: '1', content: 'hello world' };
    searchIndex.insertDocument(document);
    expect(
      searchIndex.searchDocuments('hello', {} as QueryOptions).length,
    ).toBe(1);
  });

  test('insertMultipleDocuments adds multiple documents', () => {
    const documents = [
      { id: '1', content: 'hello world' },
      { id: '2', content: 'goodbye world' },
    ];
    searchIndex.insertMultipleDocuments(documents);
    expect(searchIndex.searchDocuments('world').length).toBe(2);
  });

  test('searchDocuments can find inserted documents', () => {
    const document = { id: '1', content: 'hello world' };
    searchIndex.insertDocument(document);
    const results: SearchResult<PicosearchDocument>[] =
      searchIndex.searchDocuments('hello', {} as QueryOptions);
    expect(results[0].doc.id).toBe(document.id);
  });

  test('searchDocuments throws error on unknown field', () => {
    const document = { id: '1', content: 'hello world' };
    searchIndex.insertDocument(document);
    expect(() =>
      searchIndex.searchDocuments('hello', {
        fields: ['unknown'],
      } as QueryOptions),
    ).toThrow(`Unknown field 'unknown'!`);
  });

  test('searchDocuments with multiple fields', () => {
    const documents = [
      { id: '1', title: 'greetings world', content: 'hello world' },
      { id: '2', title: 'farewell', content: 'goodbye world' },
    ];
    searchIndex.insertMultipleDocuments(documents);
    const results = searchIndex.searchDocuments('world', {
      fields: ['title', 'content'],
    });
    expect(results.length).toBe(2);
    expect(results[0].doc.title).toBe('greetings world');
    expect(results[1].doc.title).toBe('farewell');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  test('searchDocuments with weighted fields', () => {
    const documents = [
      { id: '1', title: 'greetings world', content: 'hello' },
      { id: '2', title: 'farewell', content: 'goodbye world' },
    ];
    searchIndex.insertMultipleDocuments(documents);
    const results = searchIndex.searchDocuments('world', {
      fields: ['title', 'content^2'],
    });
    expect(results[0].doc.title).toBe('farewell');
    expect(results[1].doc.title).toBe('greetings world');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });
});

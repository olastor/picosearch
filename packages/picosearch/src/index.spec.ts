import { fc, test } from '@fast-check/vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { Picosearch } from './index';
import type {
  IPicosearch,
  PicosearchDocument,
  QueryOptions,
  SearchResult,
} from './types';

describe('Picosearch', () => {
  let searchIndex: IPicosearch<PicosearchDocument>;

  beforeEach(() => {
    searchIndex = new Picosearch({ enableAutocomplete: true });
  });

  describe('insertDocument', () => {
    it('throws error when id is missing', () => {
      expect(() =>
        searchIndex.insertDocument({} as PicosearchDocument),
      ).toThrow(
        "The document's required 'id' field is missing or not a string.",
      );
    });

    it('insertDocument successfully adds a document', () => {
      const document = { id: '1', content: 'hello world' };
      searchIndex.insertDocument(document);
      expect(
        searchIndex.searchDocuments('hello', {} as QueryOptions).length,
      ).toBe(1);
    });

    it('insertMultipleDocuments adds multiple documents', () => {
      const documents = [
        { id: '1', content: 'hello world' },
        { id: '2', content: 'goodbye world' },
      ];
      searchIndex.insertMultipleDocuments(documents);
      expect(searchIndex.searchDocuments('world').length).toBe(2);
    });

    it('should insert raw token marker only once', () => {
      const documents = [
        { id: '1', content: 'hello world' },
        { id: '2', content: 'hello world' },
      ];
      searchIndex.insertMultipleDocuments(documents);
      // @ts-expect-error
      const node = searchIndex.searchIndex.termTree.lookup('hello', true);
      expect(node.v).toEqual([1, [0, 0, 1], [1, 0, 1]]);
    });
  });

  describe('searchDocuments', () => {
    it('searchDocuments can find inserted documents', () => {
      const document = { id: '1', content: 'hello world' };
      searchIndex.insertDocument(document);
      const results: SearchResult<PicosearchDocument>[] =
        searchIndex.searchDocuments('hello', {} as QueryOptions);
      expect(results[0].doc.id).toBe(document.id);
    });

    it('searchDocuments throws error on unknown field', () => {
      const document = { id: '1', content: 'hello world' };
      searchIndex.insertDocument(document);
      expect(() =>
        searchIndex.searchDocuments('hello', {
          fields: ['unknown'],
        } as QueryOptions),
      ).toThrow(`Unknown field 'unknown'!`);
    });

    it('searchDocuments with multiple fields', () => {
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

    it('searchDocuments with weighted fields', () => {
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

    it('searchDocuments with limit', () => {
      const documents = [
        { id: '1', title: 'greetings world', content: 'hello' },
        { id: '2', title: 'farewell', content: 'goodbye world' },
      ];
      searchIndex.insertMultipleDocuments(documents);
      const results = searchIndex.searchDocuments('world', {
        limit: 1,
      });
      expect(results.length).toBe(1);
    });

    it('searchDocuments with fuzzy search', () => {
      const documents = [
        { id: '1', title: 'greetings world', content: 'hello' },
        { id: '2', title: 'farewell', content: 'goodbye world' },
      ];
      searchIndex.insertMultipleDocuments(documents);
      const results = searchIndex.searchDocuments('word', {
        fuzziness: 'AUTO',
      });
      expect(results.length).toBe(2);
    });

    test.prop([fc.array(fc.stringMatching(/^[a-zA-Z0-9]+$/))])(
      '(prop) it should always find the document with the exact match',
      (documents: string[]) => {
        const searchIndex = new Picosearch();
        documents.forEach((doc, i) =>
          searchIndex.insertDocument({ id: String(i), content: doc }),
        );
        documents.forEach((doc, i) => {
          const results = searchIndex.searchDocuments(doc);
          expect(results.some((result) => result.id === String(i))).toBe(true);
        });
      },
    );
  });

  describe('autocomplete', () => {
    it('throws error when autocomplete is not enabled', () => {
      const documents = [
        { id: '1', title: 'greetings world', content: 'hello' },
        { id: '2', title: 'farewell', content: 'goodbye world' },
      ];
      const searchIndex = new Picosearch();
      searchIndex.insertMultipleDocuments(documents);
      expect(() => searchIndex.autocomplete('hello')).toThrow(
        'Autocomplete is not enabled!',
      );
    });

    it('returns the correct prefix autocomplete', () => {
      const documents = [
        { id: '1', title: 'greetings world', content: 'hello' },
        { id: '2', title: 'farewell', content: 'goodbye world' },
      ];
      searchIndex.insertMultipleDocuments(documents);
      const results = searchIndex.autocomplete('hel');
      expect(results).toEqual(['hello']);
      expect(searchIndex.autocomplete('fare')).toEqual(['farewell']);
      expect(searchIndex.autocomplete('')).toEqual([
        'farewell',
        'goodbye',
        'greetings',
        'hello',
        'world',
      ]);
      expect(searchIndex.autocomplete('unknown')).toEqual([]);
      expect(searchIndex.autocomplete('g')).toEqual(['goodbye', 'greetings']);
    });

    it('returns the correct fuzzy autocomplete', () => {
      const documents = [
        { id: '1', title: 'greetings world', content: 'hello' },
        { id: '2', title: 'farewell', content: 'goodbye world' },
      ];
      searchIndex.insertMultipleDocuments(documents);

      expect(searchIndex.autocomplete('helo', { method: 'fuzzy' })).toEqual([
        'hello',
      ]);
      expect(searchIndex.autocomplete('fare', { method: 'fuzzy' })).toEqual([]);
      expect(
        searchIndex.autocomplete('fare', { method: 'fuzzy', fuzziness: 4 }),
      ).toEqual(['farewell', 'world']);
      expect(searchIndex.autocomplete('', { method: 'fuzzy' })).toEqual([]);
      expect(searchIndex.autocomplete('unknown', { method: 'fuzzy' })).toEqual(
        [],
      );
      expect(searchIndex.autocomplete('goodby', { method: 'fuzzy' })).toEqual([
        'goodbye',
      ]);
    });

    it('should not include processed tokens', () => {
      const documents = [
        { id: '1', title: 'greetings world', content: 'hello' },
        { id: '2', title: 'farewell', content: 'goodbye world' },
      ];
      const analyzer = (token: string) => {
        if (token === 'hello') return 'hell';
        if (token === 'world') return 'worl';
        return '';
      };

      const searchIndex = new Picosearch({
        analyzer,
        enableAutocomplete: true,
      });
      searchIndex.insertMultipleDocuments(documents);
      expect(searchIndex.autocomplete('hel', { method: 'prefix' })).toEqual([
        'hello',
      ]);
      expect(
        searchIndex.autocomplete('hel', { method: 'fuzzy', fuzziness: 2 }),
      ).toEqual(['hello']);
    });
  });

  describe('toJSON/fromJSON', () => {
    it('export/import does not affect search', () => {
      const documents = [
        { id: '1', title: 'greetings world', content: 'hello' },
        { id: '2', title: 'farewell', content: 'goodbye world' },
      ];
      searchIndex.insertMultipleDocuments(documents);

      const newSearchIndex = Picosearch.fromJSON(searchIndex.toJSON());
      const results = newSearchIndex.searchDocuments('world', {
        fields: ['title', 'content^2'],
        includeDocs: true,
      });
      expect(results[0].doc.title).toBe('farewell');
      expect(results[1].doc.title).toBe('greetings world');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('exporting twice results in the same JSON string', () => {
      const documents = [
        { id: '1', title: 'greetings world', content: 'hello' },
        { id: '2', title: 'farewell', content: 'goodbye world' },
      ];
      searchIndex.insertMultipleDocuments(documents);

      const json = searchIndex.toJSON();
      const index2 = Picosearch.fromJSON(json);
      expect(index2.toJSON()).toEqual(json);
    });

    test.prop([fc.array(fc.string())])(
      '(prop) exporting twice results in the same JSON string',
      (documents: string[]) => {
        const searchIndex = new Picosearch({ enableAutocomplete: true });
        documents.forEach((doc, i) =>
          searchIndex.insertDocument({ id: String(i), content: doc }),
        );
        const json = searchIndex.toJSON();
        const index2 = Picosearch.fromJSON(json);
        expect(index2.toJSON()).toEqual(json);
      },
    );
  });
});

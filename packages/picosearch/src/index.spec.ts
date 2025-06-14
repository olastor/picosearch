import { fc, test } from '@fast-check/vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { Picosearch } from './index';
import type {
  Analyzer,
  IPicosearch,
  PicosearchDocument,
  QueryOptions,
  SearchResult,
  SearchResultWithDoc,
} from './types';

describe('Picosearch', () => {
  let searchIndex: IPicosearch<{ id: string; title: string; content: string }>;

  beforeEach(() => {
    searchIndex = new Picosearch({ enableAutocomplete: true });
  });

  describe('insertDocument', () => {
    it('throws error when id is missing', () => {
      expect(() =>
        searchIndex.insertDocument(
          {} as { id: string; title: string; content: string },
        ),
      ).toThrow(
        "The document's required 'id' field is missing or not a string.",
      );
    });

    it('insertDocument successfully adds a document', async () => {
      const document = {
        id: '1',
        title: 'hello world',
        content: 'hello world',
      };
      searchIndex.insertDocument(document);
      const results = await searchIndex.searchDocuments('hello');
      expect(results.length).toBe(1);
    });

    it('insertMultipleDocuments adds multiple documents', async () => {
      const documents = [
        { id: '1', title: 'hello world', content: 'hello world' },
        { id: '2', title: 'goodbye world', content: 'goodbye world' },
      ];
      searchIndex.insertMultipleDocuments(documents);
      const results = await searchIndex.searchDocuments('world');
      expect(results.length).toBe(2);
    });

    it('should insert raw token marker only once', () => {
      const documents = [
        { id: '1', content: 'hello world', title: '' },
        { id: '2', content: 'hello world', title: '' },
      ];
      searchIndex.insertMultipleDocuments(documents);
      // @ts-expect-error
      const node = searchIndex.searchIndex.termTree.lookup('hello', true);
      expect(node.v).toEqual([1, [0, 0, 1], [1, 0, 1]]);
    });

    it('should insert only selected fields', async () => {
      const searchIndex = new Picosearch({ indexedFields: ['content'] });
      const documents = [
        { id: '1', content: 'hello world', title: '' },
        { id: '2', content: 'hello world', title: 'title' },
      ];
      searchIndex.insertMultipleDocuments(documents);
      await expect(searchIndex.searchDocuments('hello')).resolves.toHaveLength(
        2,
      );
      await expect(searchIndex.searchDocuments('title')).resolves.toHaveLength(
        0,
      );
    });
  });

  describe('searchDocuments', () => {
    it('searchDocuments can find inserted documents', async () => {
      const document = {
        id: '1',
        title: 'hello world',
        content: 'hello world',
      };
      searchIndex.insertDocument(document);
      const results: SearchResultWithDoc<{
        id: string;
        title: string;
        content: string;
      }>[] = await searchIndex.searchDocuments('hello', { includeDocs: true });
      expect(results[0].doc.id).toBe(document.id);
    });

    it('should not include document if includeDocs is false', async () => {
      const document = {
        id: '1',
        title: 'hello world',
        content: 'hello world',
      };
      searchIndex.insertDocument(document);
      const results: SearchResult[] = await searchIndex.searchDocuments(
        'hello',
        { includeDocs: false },
      );
      expect(results[0]).not.toHaveProperty('doc');
    });

    it('should use getDocumentById from constructor if provided', async () => {
      const document = {
        id: '1',
        title: 'hello world',
        content: 'hello world',
      };
      const docFromFunction = {
        id: '1',
        title: 'hello world',
        content: 'from function',
      };
      const searchIndex = new Picosearch({
        getDocumentById: (id: string) => Promise.resolve(docFromFunction),
      });
      searchIndex.insertDocument(document);
      const results: SearchResultWithDoc<{
        id: string;
        title: string;
        content: string;
      }>[] = await searchIndex.searchDocuments('hello', { includeDocs: true });
      expect(results[0].doc).toEqual(docFromFunction);
    });

    it('should use getDocumentById from options if provided', async () => {
      const document = {
        id: '1',
        title: 'hello world',
        content: 'hello world',
      };
      const docFromFunction = {
        id: '1',
        title: 'hello world',
        content: 'from function',
      };
      searchIndex.insertDocument(document);
      const getDocumentById = (id: string) => Promise.resolve(docFromFunction);
      const results: SearchResultWithDoc<{
        id: string;
        title: string;
        content: string;
      }>[] = await searchIndex.searchDocuments('hello', {
        includeDocs: true,
        getDocumentById,
      });
      expect(results[0].doc).toEqual(docFromFunction);
    });

    it('searchDocuments throws error on unknown field', async () => {
      const document = {
        id: '1',
        content: 'hello world',
        title: 'hello world',
      };
      searchIndex.insertDocument(document);
      await expect(
        searchIndex.searchDocuments('hello', {
          fields: ['unknown'],
          includeDocs: true,
        }),
      ).rejects.toThrow(`Unknown field 'unknown'!`);
    });

    it('searchDocuments with multiple fields', async () => {
      const documents = [
        { id: '1', title: 'greetings world', content: 'hello world' },
        { id: '2', title: 'farewell', content: 'goodbye world' },
      ];
      searchIndex.insertMultipleDocuments(documents);
      const results = await searchIndex.searchDocuments('world', {
        fields: ['title', 'content'],
        includeDocs: true,
      });
      expect(results.length).toBe(2);
      expect(results[0].doc.title).toBe('greetings world');
      expect(results[1].doc.title).toBe('farewell');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('searchDocuments with weighted fields', async () => {
      const documents = [
        { id: '1', title: 'greetings world', content: 'hello' },
        { id: '2', title: 'farewell', content: 'goodbye world' },
      ];
      searchIndex.insertMultipleDocuments(documents);
      const results = await searchIndex.searchDocuments('world', {
        fields: ['title', 'content^2'],
        includeDocs: true,
      });
      expect(results[0].doc.title).toBe('farewell');
      expect(results[1].doc.title).toBe('greetings world');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('searchDocuments with limit', async () => {
      const documents = [
        { id: '1', title: 'greetings world', content: 'hello' },
        { id: '2', title: 'farewell', content: 'goodbye world' },
      ];
      searchIndex.insertMultipleDocuments(documents);
      const results = await searchIndex.searchDocuments('world', {
        limit: 1,
      });
      expect(results.length).toBe(1);
    });

    it('searchDocuments with fuzzy search', async () => {
      const documents = [
        { id: '1', title: 'greetings world', content: 'hello' },
        { id: '2', title: 'farewell', content: 'goodbye world' },
      ];
      searchIndex.insertMultipleDocuments(documents);
      const results = await searchIndex.searchDocuments('word', {
        fuzziness: 'AUTO',
      });
      expect(results.length).toBe(2);
    });

    test.prop([fc.array(fc.stringMatching(/^[a-zA-Z0-9]+$/))])(
      '(prop) it should always find the document with the exact match',
      async (documents: string[]) => {
        const searchIndex = new Picosearch();
        documents.forEach((doc, i) =>
          searchIndex.insertDocument({ id: String(i), content: doc }),
        );
        for (let i = 0; i < documents.length; i++) {
          const doc = documents[i];
          const results = await searchIndex.searchDocuments(doc);
          expect(results.some((result) => result.id === String(i))).toBe(true);
        }
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
    it('should support serialization and deserialization', async () => {
      const documents = [
        { id: '1', title: 'greetings world', content: 'hello' },
        { id: '2', title: 'farewell', content: 'goodbye world' },
      ];
      searchIndex.insertMultipleDocuments(documents);

      const newSearchIndex = Picosearch.fromJSON(searchIndex.toJSON());
      const results = await newSearchIndex.searchDocuments('world', {
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

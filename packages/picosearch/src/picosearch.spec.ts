import { fc, test } from '@fast-check/vitest';
import * as englishAnalyzerOptions from '@picosearch/language-english';
import nock from 'nock';
import { beforeEach, describe, expect, it } from 'vitest';
import { Picosearch } from './index';
import type { IPicosearch, SearchResult, SearchResultWithDoc } from './types';

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
      const searchIndex = new Picosearch({
        indexedFields: ['content.text', 'content.names.0.1'],
      });
      const documents = [
        {
          id: '1',
          content: { text: 'hello world', title: 'Henry' },
          title: '',
        },
        {
          id: '2',
          content: { text: 'hello world', names: [['Hugo', 'Henry'], 'Lina'] },
          title: 'title',
        },
      ];
      searchIndex.insertMultipleDocuments(documents);
      await expect(searchIndex.searchDocuments('hello')).resolves.toHaveLength(
        2,
      );
      const henry = await searchIndex.searchDocuments('Henry');
      expect(henry).toHaveLength(1);
      expect(henry[0]).toHaveProperty('id', '2');
      await expect(searchIndex.searchDocuments('title')).resolves.toHaveLength(
        0,
      );
      await expect(searchIndex.searchDocuments('Hugo')).resolves.toHaveLength(
        0,
      );
      await expect(searchIndex.searchDocuments('Lina')).resolves.toHaveLength(
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
      expect(results[0]?.doc?.id).toBe(document.id);
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
        keepDocuments: false,
        getDocumentById: (id: string) => Promise.resolve(docFromFunction),
      });
      searchIndex.insertDocument(document);
      const results = await searchIndex.searchDocuments('hello', {
        includeDocs: true,
      });
      expect(results[0].doc).toEqual(docFromFunction);
    });

    it('should use getDocumentById from query options if provided', async () => {
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
      expect(results[0].doc?.title).toBe('greetings world');
      expect(results[1].doc?.title).toBe('farewell');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('searchDocuments with highlighted fields', async () => {
      const documents = [
        { id: '1', title: 'greetings world', content: 'hello' },
        { id: '2', title: 'farewell', content: 'goodbye world' },
      ];
      searchIndex.insertMultipleDocuments(documents);
      const results = await searchIndex.searchDocuments('farewell world', {
        fields: ['title', 'content^2'],
        includeDocs: true,
        highlightedFields: ['title', 'content'],
      });
      expect(results[0].doc?.title).toBe('<b>farewell</b>');
      expect(results[0].doc?.content).toBe('goodbye <b>world</b>');
      expect(results[1].doc?.title).toBe('greetings <b>world</b>');
      expect(results[1].doc?.content).toBe('hello');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('searchDocuments with english text', async () => {
      const documents = [
        {
          id: '1',
          title: 'greetings world',
          content:
            'Hello, how are you? I am fine, thank you. How is the weather in New York? It is sunny. How is the weather in London? It is rainy.',
        },
      ];
      const searchIndex = new Picosearch({
        ...englishAnalyzerOptions,
      });
      searchIndex.insertMultipleDocuments(documents);
      const results = await searchIndex.searchDocuments(
        'How is the weather in London? Is it sunny?',
        {
          includeDocs: true,
          highlightedFields: ['title', 'content'],
        },
      );
      expect(results[0].doc?.title).toBe('greetings world');
      expect(results[0].doc?.content).toBe(
        'Hello, how are you? I am fine, thank you. How is the <b>weather</b> in New York? It is <b>sunny</b>. How is the <b>weather</b> in <b>London</b>? It is rainy.',
      );
    });

    it('searchDocuments with highlighted fields and custom tags', async () => {
      const documents = [
        { id: '1', title: 'greetings world', content: 'hello' },
        { id: '2', title: 'farewell', content: 'goodbye world' },
      ];
      searchIndex.insertMultipleDocuments(documents);
      const results = await searchIndex.searchDocuments('farewell world', {
        fields: ['title', 'content^2'],
        includeDocs: true,
        highlightedFields: ['title', 'content'],
        highlightTag: {
          before: '<em>',
          after: '</em>',
        },
      });
      expect(results[0].doc?.title).toBe('<em>farewell</em>');
      expect(results[0].doc?.content).toBe('goodbye <em>world</em>');
      expect(results[1].doc?.title).toBe('greetings <em>world</em>');
      expect(results[1].doc?.content).toBe('hello');
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
      expect(results[0].doc?.title).toBe('farewell');
      expect(results[1].doc?.title).toBe('greetings world');
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

    it('searchDocuments with idFilter', async () => {
      const documents = [
        { id: 'id-1', title: 'greetings world', content: 'hello' },
        { id: 'id-2', title: 'farewell', content: 'goodbye world' },
        { id: 'id-3', title: 'another world', content: 'hello world' },
      ];
      searchIndex.insertMultipleDocuments(documents);

      // Test filtering to only include documents with odd IDs
      const resultsOddIds = await searchIndex.searchDocuments('world', {
        idFilter: (id: string) => Number.parseInt(id[3]) % 2 === 1,
        includeDocs: false,
      });
      expect(resultsOddIds.length).toBe(2);
      expect(resultsOddIds.map((r) => r.id).sort()).toEqual(['id-1', 'id-3']);

      // Test filtering to only include specific document
      const resultsSpecific = await searchIndex.searchDocuments('world', {
        idFilter: (id: string) => id === 'id-2',
        includeDocs: true,
      });
      expect(resultsSpecific.length).toBe(1);
      expect(resultsSpecific[0].id).toBe('id-2');
      expect(resultsSpecific[0].doc?.title).toBe('farewell');

      // Test filtering that excludes all documents
      const resultsNone = await searchIndex.searchDocuments('world', {
        idFilter: (id: string) => id === 'nonexistent',
      });
      expect(resultsNone.length).toBe(0);
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
      expect(results[0]?.doc?.title).toBe('farewell');
      expect(results[1]?.doc?.title).toBe('greetings world');
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

  describe('sync()', () => {
    const getMemoryStorageDriver = () => {
      let storage = '';
      return {
        get: () => Promise.resolve(storage),
        persist: (value: string) => {
          storage = value;
          return Promise.resolve();
        },
        delete: () => Promise.resolve(),
      };
    };

    const documents = [
      { id: '1', title: 'greetings world', content: 'hello' },
      { id: '2', title: 'farewell', content: 'goodbye world' },
      { id: '3', title: 'say goodbye', content: 'goodbye to you' },
      { id: '4', title: 'say hello', content: 'hello to you' },
    ];

    it('should not sync to the local storage in dry run', async () => {
      const storage = getMemoryStorageDriver();
      const searchIndex = new Picosearch({
        storageDriver: {
          type: 'custom',
          driver: storage,
        },
      });
      searchIndex.insertMultipleDocuments(documents);
      expect(await storage.get()).toEqual('');
      const result = await searchIndex.sync({ dryRun: true });
      expect(result.hasWrittenToStorage).toBe(false);
      expect(result.hasLoadedIndexFromStorage).toBe(false);
      expect(result.hasLoadedIndexFromRemote).toBe(false);
      expect(result.numberOfAppliedPatches).toBe(0);
      expect(result.bytesLoaded).toBe(0);
      expect(await storage.get()).toEqual('');
    });

    it('should sync to the local storage', async () => {
      const storage = getMemoryStorageDriver();
      const searchIndex = new Picosearch({
        storageDriver: {
          type: 'custom',
          driver: storage,
        },
      });
      searchIndex.insertMultipleDocuments(documents);
      expect(await storage.get()).toEqual('');
      const result = await searchIndex.sync();
      expect(result.hasWrittenToStorage).toBe(true);
      expect(result.hasLoadedIndexFromStorage).toBe(false);
      expect(result.hasLoadedIndexFromRemote).toBe(false);
      expect(result.numberOfAppliedPatches).toBe(0);
      expect(result.bytesLoaded).toBe(0);
      expect(await storage.get()).toEqual(searchIndex.toJSON());
    });

    it('should not try to fetch when offline is true', async () => {
      const storage = getMemoryStorageDriver();
      const searchIndex = new Picosearch({
        indexUrl: 'https://example.com/index.json',
        storageDriver: {
          type: 'custom',
          driver: storage,
        },
      });
      searchIndex.insertMultipleDocuments(documents);
      const result = await searchIndex.sync({ offline: true });
      expect(result.hasWrittenToStorage).toBe(true);
      expect(result.hasLoadedIndexFromStorage).toBe(false);
      expect(result.hasLoadedIndexFromRemote).toBe(false);
      expect(result.numberOfAppliedPatches).toBe(0);
      expect(result.bytesLoaded).toBe(0);
    });

    it('should fetch the index from the remote url if index is empty', async () => {
      const indexUrl = 'https://example.com/index.json';

      const memoryStorage = getMemoryStorageDriver();
      const searchIndex = new Picosearch({
        indexUrl,
        storageDriver: { type: 'custom', driver: memoryStorage },
      });
      const remoteIndex = searchIndex.clone();
      remoteIndex.insertMultipleDocuments(documents);
      const remoteIndexJson = remoteIndex.toJSON();
      nock('https://example.com/')
        .get('/index.json')
        .reply(200, remoteIndexJson);

      const result = await searchIndex.sync();
      expect(result.hasWrittenToStorage).toBe(true);
      expect(result.hasLoadedIndexFromStorage).toBe(false);
      expect(result.hasLoadedIndexFromRemote).toBe(true);
      expect(result.numberOfAppliedPatches).toBe(0);
      expect(result.bytesLoaded).toBe(remoteIndexJson.length);

      const searchIndexJson = searchIndex.toJSON();
      expect(searchIndexJson).toEqual(remoteIndexJson);
      expect(await memoryStorage.get()).toEqual(searchIndexJson);
    });

    it('should fetch patches from the remote url if index is not empty', async () => {
      const indexUrl = 'https://example.com/index.json';
      const patchUrl = 'https://example.com/patches/v{version}.json';

      const memoryStorage = getMemoryStorageDriver();
      const searchIndex = new Picosearch({
        indexUrl,
        patchUrl,
        storageDriver: { type: 'custom', driver: memoryStorage },
      });
      searchIndex.insertMultipleDocuments(documents.slice(0, 2));
      await searchIndex.persist();

      const remoteIndex = Picosearch.fromJSON(searchIndex.toJSON());
      const patch1 = remoteIndex.createPatch({ add: [documents[2]] });
      remoteIndex.applyPatch(patch1);
      const patch2 = remoteIndex.createPatch({ add: [documents[3]] });
      remoteIndex.applyPatch(patch2);

      nock('https://example.com/')
        .get(/\/patches\/v\d+\.json/)
        .times(3)
        .reply((uri) => {
          const version = uri.match(/\/patches\/v(\d+)\.json/)?.[1];
          if (version === '1') return [200, patch1];
          if (version === '2') return [200, patch2];
          return [404];
        });

      const result = await searchIndex.sync();
      expect(result.hasWrittenToStorage).toBe(true);
      expect(result.hasLoadedIndexFromStorage).toBe(false);
      expect(result.hasLoadedIndexFromRemote).toBe(false);
      expect(result.numberOfAppliedPatches).toBe(2);
      expect(result.bytesLoaded).toBeGreaterThan(0);

      const searchIndexJson = searchIndex.toJSON();
      expect(searchIndexJson).toEqual(remoteIndex.toJSON());
      expect(await memoryStorage.get()).toEqual(searchIndexJson);
    });
  });
});

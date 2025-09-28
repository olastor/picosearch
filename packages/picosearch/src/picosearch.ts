import { RadixBKTreeMap } from '@picosearch/radix-bk-tree';
import {
  DEFAULT_MAX_VERSION_UPDATES,
  UNSERIALIZABLE_OPTIONS,
} from './constants';
import { applyPatch, createPatch } from './patch';
import {
  type AutocompleteOptions,
  AutocompleteOptionsSchema,
  type Options,
  OptionsSchema,
  type ParsedOptions,
  type QueryOptions,
  QueryOptionsSchema,
  type SearchIndex,
  type StorageDriver,
  type SyncOptions,
  SyncOptionsSchema,
} from './schemas';
import { autocomplete, search } from './search';
import { getStorageDriver } from './storage';
import type {
  Analyzer,
  Document,
  IPicosearch,
  Patch,
  SearchResult,
  SearchResultWithDoc,
  SerializedInstance,
  SyncResult,
  Tokenizer,
  UnserializableOptions,
} from './types';
import type { FetchMetadata } from './types';
import { fetchFromRemote, getEmptyIndex, omit } from './util';

/**
 * The default tokenizer, which splits the document into words by matching \w+.
 */
export const defaultTokenizer: Tokenizer = (doc: string): string[] =>
  doc.match(/\w+/g) || [];

/**
 * The default analyzer, which only lowercases the token.
 */
export const defaultAnalyzer: Analyzer = (token: string): string =>
  token.toLowerCase();

export class Picosearch<T extends Document> implements IPicosearch<T> {
  private opts: Omit<ParsedOptions<T>, 'searchIndex'>;
  private searchIndex: SearchIndex<T>;
  private storageDriver?: StorageDriver;

  /**
   * Creates a new Picosearch instance.
   *
   * @param options The options to use for the Picosearch instance.
   */
  constructor(options?: Options<T>) {
    const { searchIndex, ...opts } = options ?? {};
    this.opts = OptionsSchema.parse(opts ?? {});
    this.searchIndex = searchIndex ?? getEmptyIndex<T>();
    this.storageDriver = getStorageDriver(this.opts);
  }

  private async loadIndexFromStorage(): Promise<{ success: boolean }> {
    if (!this.storageDriver) {
      return { success: false };
    }

    const serializedIndex = await this.storageDriver.get();
    if (!serializedIndex) {
      return { success: false };
    }

    const { opts, index } = JSON.parse(
      serializedIndex,
    ) as SerializedInstance<T>;

    this.opts = {
      ...this.opts,
      ...opts,
    };

    this.searchIndex = {
      ...index,
      termTree: RadixBKTreeMap.fromMinified(index.termTree),
    };

    return { success: true };
  }

  private async loadIndexFromRemote(dryRun = false): Promise<FetchMetadata> {
    if (!this.opts.indexUrl) {
      return { success: false, bytesLoaded: 0 };
    }

    if (dryRun) {
      return fetchFromRemote<SerializedInstance<T>>(this.opts.indexUrl, true);
    }

    const result = await fetchFromRemote<SerializedInstance<T>>(
      this.opts.indexUrl,
      false,
    );

    if (!result.success) {
      return { success: false, bytesLoaded: result.bytesLoaded };
    }

    const { opts, index } = result.data;

    this.opts = {
      ...this.opts,
      ...opts,
    };

    this.searchIndex = {
      ...index,
      termTree: RadixBKTreeMap.fromMinified(index.termTree),
    };

    return { success: true, bytesLoaded: result.bytesLoaded };
  }

  private async loadNewUpdates(
    maxVersionUpdates = DEFAULT_MAX_VERSION_UPDATES,
    dryRun = false,
  ): Promise<{ numberOfAppliedPatches: number } & FetchMetadata> {
    if (!this.opts.patchUrl) {
      return { numberOfAppliedPatches: 0, bytesLoaded: 0, success: false };
    }

    // TODO: batch requests instead of sequential requests
    const result = { numberOfAppliedPatches: 0, bytesLoaded: 0, success: true };
    const initialVersion = this.searchIndex.version;
    for (
      ;
      result.numberOfAppliedPatches < maxVersionUpdates;
      result.numberOfAppliedPatches++
    ) {
      const nextVersion = initialVersion + result.numberOfAppliedPatches + 1;

      const patchUrl = this.opts.patchUrl.replace(
        '{version}',
        nextVersion.toString(),
      );

      if (dryRun) {
        const metadata = await fetchFromRemote<Patch<T>>(patchUrl, true);
        result.bytesLoaded += metadata.bytesLoaded;
        if (!metadata.success) {
          result.success = false;
          return result;
        }

        continue;
      }

      const patch = await fetchFromRemote<Patch<T>>(patchUrl, false);
      result.bytesLoaded += patch.bytesLoaded;
      if (!patch.success) {
        result.success = false;
        return result;
      }

      this.applyPatch(patch.data);
    }

    return result;
  }

  /**
   * Creates a patch to add documents to the index. This leaves the search index unchanged
   * and returns an object that can be passed to `applyPatch` to update the same index.
   *
   * This is useful for scenarios where you want to provide small incremental updates to an existing
   * search index without having to replace the entire index.
   *
   * @param add The documents to add to the index.
   * @returns A patch that can be passed to `applyPatch` to update the same index.
   */
  createPatch({ add }: { add: T[] }): Patch<T> {
    const patch = createPatch<T>(this.opts, this.searchIndex)({ add });
    return patch;
  }

  /**
   * Applies a patch to the index. This will update the index in place.
   * The patch must have been created from the current index (not necessarily the same instance, though)
   * and there must not have been a different patch of the same version applied to this instance already.
   *
   * @param patch The patch to apply.
   */
  applyPatch(patch: Patch<T>, updateVersion = true): void {
    applyPatch<T>(this.searchIndex, updateVersion)(patch);
  }

  /**
   * Inserts multiple documents into the index.
   * @param documents The documents to insert.
   */
  insertDocument(document: T): void {
    this.insertMultipleDocuments([document]);
  }

  /**
   * Inserts a document into the index.
   * @param document The document to insert.
   */
  insertMultipleDocuments(documents: T[]): void {
    this.applyPatch(this.createPatch({ add: documents }), false);
  }

  /**
   * Searches for documents matching the query string.
   *
   * @param query The query string to search for.
   * @param options The options to use for the search.
   *
   * @returns An array of search results together with the documents.
   */
  async searchDocuments(
    query: string,
    options?: Omit<QueryOptions, 'includeDocs'> & { includeDocs: true },
  ): Promise<SearchResultWithDoc<T>[]>;

  /**
   * Searches for documents matching the query string.
   *
   * @param query The query string to search for.
   * @param options The options to use for the search.
   *
   * @returns An array of search results.
   */
  async searchDocuments(
    query: string,
    options?: Omit<QueryOptions, 'includeDocs'> & { includeDocs?: false },
  ): Promise<SearchResult[]>;

  async searchDocuments(
    query: string,
    options?: QueryOptions,
  ): Promise<SearchResult[] | SearchResultWithDoc<T>[]> {
    // TODO: validate highlighted fields
    const parsedOptions = QueryOptionsSchema.parse(options ?? {});
    return search<T>(this.opts, this.searchIndex)(query, parsedOptions);
  }

  /**
   * Autocomplete a word with fuzzy matching. Autocompletion is always case-insensitive.
   *
   * @param word The word to autocomplete.
   * @param options The options to use for the autocomplete.
   * @returns An array of autocomplete results.
   */
  autocomplete(word: string, options?: AutocompleteOptions): string[] {
    const parsedOptions = AutocompleteOptionsSchema.parse(options ?? {});
    return autocomplete(this.opts, this.searchIndex)(word, parsedOptions);
  }

  /**
   * Gets the number of documents in the index.
   * @returns The number of documents in the index.
   */
  getDocCount(): number {
    return this.searchIndex?.docCount ?? 0;
  }

  /**
   * Persists the index to the storage driver.
   *
   * @returns Whether the index was persisted successfully.
   */
  async persist(): Promise<{ success: boolean }> {
    if (!this.storageDriver) {
      return { success: false };
    }

    await this.storageDriver.persist(this.toJSON());
    return { success: true };
  }

  /**
   * Syncs the index with the local and remote storage.
   * First tries to load the index from the local storage.
   * Then tries to load the index or patches from the remote storage.
   * The updated index is then persisted to the local storage.
   *
   * @param options The options to use for the sync.
   * @returns
   */
  async sync(options?: SyncOptions): Promise<SyncResult> {
    const { maxVersionUpdates, persist, offline, dryRun } =
      SyncOptionsSchema.parse(options ?? {});

    const result: SyncResult = {
      hasLoadedIndexFromStorage: false,
      hasWrittenToStorage: false,
      hasLoadedIndexFromRemote: false,
      numberOfAppliedPatches: 0,
      bytesLoaded: 0,
    };

    if (this.getDocCount() === 0) {
      // try to load index from storage when the index is empty,
      // but not if the index is not empty because loading from
      // storage overrides the current index in memory, which
      // might have new documents added that were not persisted.
      const { success } = await this.loadIndexFromStorage();
      result.hasLoadedIndexFromStorage = success;
    }

    if (!offline) {
      if (this.getDocCount() > 0 && this.opts.patchUrl) {
        // try to load incremental updates
        const { numberOfAppliedPatches, bytesLoaded, success } =
          await this.loadNewUpdates(maxVersionUpdates, dryRun);
        result.numberOfAppliedPatches = numberOfAppliedPatches;
        result.bytesLoaded += bytesLoaded;
        result.hasLoadedIndexFromRemote = success;
      }

      if (this.getDocCount() === 0) {
        // if the index is still empty, try to load it from the remote
        const { bytesLoaded, success } = await this.loadIndexFromRemote(dryRun);
        result.bytesLoaded += bytesLoaded;
        result.hasLoadedIndexFromRemote = success;
      }
    }

    if (persist && !dryRun) {
      const { success } = await this.persist();
      result.hasWrittenToStorage = success;
    }

    return result;
  }

  /**
   * Serializes the index to a JSON string.
   * @returns A JSON string representing the index.
   */
  toJSON(): string {
    const jsonObj: SerializedInstance<T> = {
      index: {
        ...this.searchIndex,
        termTree: this.searchIndex.termTree.toMinified(),
      },
      opts: omit(this.opts, UNSERIALIZABLE_OPTIONS),
    } satisfies SerializedInstance<T> & {
      opts: Record<string, number | string | string[] | boolean | undefined>;
    };

    return JSON.stringify(jsonObj);
  }

  /**
   * Deserializes a JSON string into a Picosearch instance.
   *
   * @param json The JSON string to deserialize.
   * @param languageOpts Optional language-specific options for the tokenizer and analyzer.
   *
   * @returns A Picosearch instance.
   */
  static fromJSON<T extends Document>(
    json: string,
    options?: Options<T>,
  ): Picosearch<T> {
    const { opts, index } = JSON.parse(json) as SerializedInstance<T>;
    const searchIndex = {
      ...index,
      termTree: RadixBKTreeMap.fromMinified(index.termTree),
    };
    const picosearch = new Picosearch<T>({
      ...opts,
      // allow overriding the stored options because you might want
      // to change for example the patch url
      ...options,
      searchIndex,
    });
    return picosearch;
  }

  /**
   * Clones the Picosearch instance. Beware that the storage driver is also cloned and
   * persisting data can cause conflicts when both the original and the cloned instance are used.
   *
   * @returns A cloned Picosearch instance.
   */
  clone(): Picosearch<T> {
    const unserializedOpts: Pick<Options<T>, UnserializableOptions> = {
      tokenizer: this.opts.tokenizer,
      analyzer: this.opts.analyzer,
      getDocumentById: this.opts.getDocumentById,
      storageDriver: this.opts.storageDriver,
    };

    return Picosearch.fromJSON(this.toJSON(), unserializedOpts);
  }
}

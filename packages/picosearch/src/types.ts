import type { MinifiedNode } from '@picosearch/radix-bk-tree';
import type { UNSERIALIZABLE_OPTIONS } from './constants';
import type {
  AutocompleteOptions,
  Options,
  QueryOptions,
  SearchIndex,
  SyncOptions,
} from './schemas';

// TODO: consider using bit-packing
export type TokenInfo = [
  internalDocumentId: number,
  fieldId: number,
  frequency: number,
];

export type RawTokenMarker = 1;

// TODO: patch type modify
// TODO: patch type delete
// TODO: patch type gone
// TODO: patch type invalidate (maybe)
// TODO: include total number of hits in result when limit is applied

export type PatchChange<T extends Document> = {
  type: 'add';
  addedFields: string[];
  addedOriginalDocumentIds: string[];
  addedTermTreeLeaves: { [token: string]: (TokenInfo | RawTokenMarker)[] };
  addedDocLengths: { [documentId: number]: { [fieldId: number]: number } };
  addedDocsById?: { [documentId: number]: T };
  addedTotalDocLengthsByFieldId: { [fieldId: number]: number };
  addedDocCountsByFieldId: { [fieldId: number]: number };
  addedDocCount: number;
};

export type Patch<T extends Document> = {
  indexId: string;
  version: number;
  // TODO: consider adding checksum or reference ID for index
  changes: PatchChange<T>[];
};

export type GetDocumentById<T extends Document> = (
  documentId: string,
) => Promise<T | null>;

export type JSONPrimitive = number | string | boolean | undefined | null;
export type JSONArray = JSONSerializable[];
export type JSONObject = { [key: string]: JSONSerializable };

// this will cause trouble when serializing/deserializing, but
// some users might not do it and still pass classes or similar objects.
// as long as they are serializable via an toJSON method, they are allowed
export type JSONConvertible = { toJSON(): JSONSerializable };

export type JSONSerializable =
  | JSONPrimitive
  | JSONConvertible
  | JSONArray
  | JSONObject;

export type FlattenedJSONObject = Record<
  string,
  JSONPrimitive | JSONConvertible
>;

export type Document = JSONObject;

export type Preprocessor = (doc: string) => string[];

export type SearchResult = {
  id: string;
  score: number;
};

export type SearchResultWithDoc<T extends Document> = SearchResult & {
  doc: T | null;
};

export interface IPicosearch<T extends Document> {
  insertDocument: (document: T) => void;
  insertMultipleDocuments: (documents: T[]) => void;

  searchDocuments: {
    (
      query: string,
      options?: Omit<QueryOptions, 'includeDocs'> & { includeDocs?: false },
    ): Promise<SearchResult[]>;
    (
      query: string,
      options: Omit<QueryOptions, 'includeDocs'> & { includeDocs: true },
    ): Promise<SearchResultWithDoc<T>[]>;
  };
  autocomplete: (prefix: string, options?: AutocompleteOptions) => string[];

  sync: (options?: SyncOptions) => Promise<SyncResult>;
  persist: () => Promise<{ success: boolean }>;
  createPatch: ({ add }: { add: T[] }) => Patch<T>;
  applyPatch: (patch: Patch<T>, updateVersion?: boolean) => void;

  getDocCount: () => number;
  clone: () => IPicosearch<T>;
  toJSON: () => string;
}

export type IStorageDriver = {
  get: () => Promise<string>;
  persist: (value: string) => Promise<void>;
  delete: () => Promise<void>;
};

export type Analyzer = (token: string) => string;
export type Tokenizer = (doc: string) => string[];

export type UnserializableOptions = (typeof UNSERIALIZABLE_OPTIONS)[number];
export type SerializedInstance<T extends Document> = {
  index: Omit<SearchIndex<T>, 'termTree'> & {
    termTree: MinifiedNode<RawTokenMarker | [number, number, number]>;
  };
  opts: Omit<Options<T>, UnserializableOptions | 'searchIndex'>;
};

export type FetchMetadata = {
  success: boolean;
  bytesLoaded: number;
};

export type SyncResult = {
  hasLoadedIndexFromStorage: boolean;
  hasWrittenToStorage: boolean;
  hasLoadedIndexFromRemote: boolean;
  numberOfAppliedPatches: number;
  bytesLoaded: number;
};

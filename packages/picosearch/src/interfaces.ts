import type { Trie } from './trie';

export type TrieNode<T> = {
  children: { [part: string]: TrieNode<T> };
  values: T[];
};

export interface ITrie<T> {
  insert: (sequence: string[], values: T[]) => void;
  search: (sequence: string[]) => T[] | null;
  toJSON: () => string;
}

export interface SearchIndex<T extends PicosearchDocument> {
  // unique list of field names, the index will be used as field ID
  fields: string[];

  // list of document IDs as passed by the user, the index will be used as document reference ID for all internal operations to be space efficient
  originalDocumentIds: (string | number)[];

  // trie to lookup token counts
  docFreqsByToken: Trie<
    [documentId: number, fieldId: number, frequency: number]
  >;

  // by document ID, get the (token-)length by the field ID
  docLengths: { [documentId: number]: { [fieldId: number]: number } };

  // by field ID get the total (token-)length (for this field) across all documents
  totalDocLengthsByFieldId: { [fieldId: number]: number };

  // by field ID get the number of documents with that field
  docCountsByFieldId: { [fieldId: number]: number };

  // the total number of documents
  docCount: number;

  // by document ID, get the document
  docsById: { [documentId: number]: T };
}

export type PicosearchOptions = {
  tokenizer?: Tokenizer;
  analyzer?: Analyzer;
  keepDocuments?: boolean;
  jsonIndex?: string;
  idField?: string;
};

export type PicosearchDocument = Record<string, string>;

export type QueryOptions = {
  fields?: string[];
  limit?: number;
  offset?: number;
  bm25?: { k1?: number; b?: number };
};

export type Preprocessor = (doc: string) => string[];

export interface IPicosearch<T extends PicosearchDocument> {
  insertDocument: (document: T) => void;
  insertMultipleDocuments: (documents: T[]) => void;
  searchDocuments: (query: string, options?: QueryOptions) => SearchResult<T>[];
  toJSON: () => string;
}

export type SearchResult<T extends PicosearchDocument> = {
  id: string | number;
  score: number;
  doc: T;
};

export type Analyzer = (token: string) => string;
export type Tokenizer = (doc: string) => string[];

export type SerializedInstance<T extends PicosearchDocument> = {
  index: SearchIndex<T>;
  opts: Omit<PicosearchOptions, 'tokenizer' | 'analyzer' | 'jsonIndex'>;
};

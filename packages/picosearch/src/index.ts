import { Picosearch } from './picosearch';
import type {
  Analyzer,
  Document,
  Patch,
  SearchResult,
  SearchResultWithDoc,
  SerializedInstance,
  SyncResult,
  Tokenizer,
} from './types';
import type { FetchMetadata } from './types';

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

export type {
  Analyzer,
  Document,
  Patch,
  SearchResult,
  SearchResultWithDoc,
  SerializedInstance,
  SyncResult,
  Tokenizer,
  FetchMetadata,
};

// Re-export types that are needed for public API but defined in schemas
export type {
  Options,
  QueryOptions,
  SearchIndex,
  SyncOptions,
  AutocompleteOptions,
} from './schemas';

// Re-export the Picosearch class
export { Picosearch };

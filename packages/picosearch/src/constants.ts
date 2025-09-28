import * as englishOptions from '@picosearch/language-english';
import * as germanOptions from '@picosearch/language-german';
import type { ParsedOptions } from './schemas';
import type { Analyzer, Tokenizer } from './types';

export const DEFAULT_ID_FIELD = 'id';

export const UNSERIALIZABLE_OPTIONS = [
  'storageDriver',
  'tokenizer',
  'analyzer',
  'getDocumentById',
] satisfies (keyof ParsedOptions<any>)[];

export const DEFAULT_MAX_VERSION_UPDATES = 1000;

export const LANGUAGE_NAMES = ['english', 'german'] as const;

// TODO: consider lazy loading via import(), but it requries making some methods async
export type LanguageName = (typeof LANGUAGE_NAMES)[number];
export const PROCESSORS_BY_LANGUAGE: Record<
  LanguageName,
  {
    tokenizer: Tokenizer;
    analyzer: Analyzer;
  }
> = {
  english: {
    tokenizer: englishOptions.tokenizer,
    analyzer: englishOptions.analyzer,
  },
  german: {
    tokenizer: germanOptions.tokenizer,
    analyzer: germanOptions.analyzer,
  },
} as const;

import type { ParsedOptions } from './schemas';

export const DEFAULT_ID_FIELD = 'id';

export const DEFAULT_STORAGE_DRIVER_KEY = 'picosearch';

export const UNSERIALIZABLE_OPTIONS = [
  'storageDriver',
  'tokenizer',
  'analyzer',
  'getDocumentById',
] satisfies (keyof ParsedOptions<any>)[];

export const DEFAULT_MAX_VERSION_UPDATES = 1000;

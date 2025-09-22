import { RadixBKTreeMap } from '@picosearch/radix-bk-tree';
import type { SearchIndex } from './schemas';
import type {
  Document,
  FetchMetadata,
  RawTokenMarker,
  TokenInfo,
} from './types';

export const parseFieldNameAndWeight = (
  fieldNameWithOptionalWeight: string,
): [fieldName: string, weight: number] => {
  const weightLoc = fieldNameWithOptionalWeight.search(/\^[0-9]*\.?[0-9]+$/);
  if (weightLoc !== -1) {
    const weight = Number.parseFloat(
      fieldNameWithOptionalWeight.slice(weightLoc + 1),
    );
    return [fieldNameWithOptionalWeight.slice(0, weightLoc), weight];
  }
  return [fieldNameWithOptionalWeight, 1];
};

export const getAutoFuzziness = (word: string): number => {
  const length = word.length;
  if (length < 3) return 0;
  if (length < 6) return 1;
  return 2;
};

export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// ref: https://github.com/radashi-org/radashi/blob/main/src/object/omit.ts
export function omit<T, TKeys extends keyof T>(
  obj: T,
  keys: readonly TKeys[],
): Omit<T, TKeys> {
  if (!obj) {
    return {} as Omit<T, TKeys>;
  }
  if (!keys || keys.length === 0) {
    return obj as Omit<T, TKeys>;
  }
  return keys.reduce(
    (acc, key) => {
      delete acc[key];
      return acc;
    },
    { ...obj },
  );
}

export const getEmptyIndex = <T extends Document>(): SearchIndex<T> => ({
  id: generateRandomString(),
  specVersion: 1,
  version: 0,
  originalDocumentIds: [],
  fields: [],
  termTree: new RadixBKTreeMap<TokenInfo | RawTokenMarker>(),
  docLengths: {},
  totalDocLengthsByFieldId: {},
  docCountsByFieldId: {},
  docCount: 0,
  docsById: {},
});

type FetchResult<T> =
  | {
      data: T;
      success: true;
      bytesLoaded: number;
    }
  | {
      data: null;
      success: false;
      bytesLoaded: 0;
    };

export async function fetchFromRemote<T>(
  url: string,
  dryRun: false,
): Promise<FetchResult<T>>;
export async function fetchFromRemote<T>(
  url: string,
  dryRun: true,
): Promise<FetchMetadata>;
export async function fetchFromRemote<T>(
  url: string,
  dryRun: boolean,
): Promise<FetchResult<T> | FetchMetadata>;
export async function fetchFromRemote<T>(
  url: string,
  dryRun: boolean,
): Promise<FetchResult<T> | FetchMetadata> {
  const response = await fetch(url, {
    ...(dryRun ? { method: 'HEAD' } : {}),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 404) {
    return { data: null, success: false, bytesLoaded: 0 };
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch url: ${url}: ${response.statusText} (code: ${response.status})`,
    );
  }

  const contentLength = response.headers.get('Content-Length');
  if (dryRun) {
    assert(
      contentLength !== null,
      'The server did not return a Content-Length header. Cannot determine the size of the response in dry run. Please check the server configuration and CORS policies.',
    );
    return { success: true, bytesLoaded: Number.parseInt(contentLength) };
  }

  if (contentLength !== null) {
    return {
      success: true,
      data: (await response.json()) as T,
      bytesLoaded: Number.parseInt(contentLength),
    };
  }

  // TODO: there is probably a better way to do this with streams that is more efficient
  const buffer = await response.arrayBuffer();
  const data = JSON.parse(new TextDecoder().decode(buffer)) as T;
  return { data, success: true, bytesLoaded: buffer.byteLength };
}

/**
 * Generate a random string of specified length
 *
 * @param length - The length of the random string to generate (default: 10)
 * @param charset - The character set to use (default: alphanumeric)
 * @returns A random string
 */
export function generateRandomString(
  length = 12,
  charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

import { RadixBKTreeMap } from '@picosearch/radix-bk-tree';
import type { SearchIndex } from './schemas';
import type {
  Document,
  FetchMetadata,
  FlattenedJSONObject,
  JSONConvertible,
  JSONObject,
  JSONPrimitive,
  JSONSerializable,
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

  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keys.includes(key as TKeys)),
  ) as Omit<T, TKeys>;
}

const isJSONPrimitive = (value: JSONSerializable): value is JSONPrimitive => {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  );
};

const isJSONConvertible = (
  value: JSONSerializable,
): value is JSONConvertible => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toJSON' in value &&
    typeof value.toJSON === 'function'
  );
};

export const flatten = (obj: JSONObject): FlattenedJSONObject => {
  const result: FlattenedJSONObject = Object.create(null);
  const stack: [string, JSONSerializable][] = Object.entries(obj);
  while (stack.length > 0) {
    const item = stack.shift();
    if (!item) continue;
    const [key, value] = item;

    const isLeaf = isJSONPrimitive(value) || isJSONConvertible(value);

    if (isLeaf) {
      result[key] = value;
      continue;
    }

    stack.push(
      ...Object.entries(value).map<[string, JSONSerializable]>(
        ([subKey, subValue]) => [`${key}.${subKey}`, subValue],
      ),
    );
  }

  return result;
};

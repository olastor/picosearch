import type { RadixTreeMapNode } from './types';

/**
 * Insert a value into a sorted array efficiently.
 *
 * Reference: https://stackoverflow.com/a/21822316
 *
 * @param array - The array to insert into. Must be sorted.
 * @param value - The value to insert.
 * @param compare - The comparison function.
 */
export const sortedInsert = <T>(
  array: T[],
  value: T,
  compare: (a: T, b: T) => number,
) => {
  let low = 0;
  let high = array.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (compare(array[mid], value) < 0) low = mid + 1;
    else high = mid;
  }
  array.splice(low, 0, value);
};

export const getNewEmptyNode = <T>(): RadixTreeMapNode<T> => [
  Object.create(null) as RadixTreeMapNode<T>[0],
];

export const getCommonPrefix = (a: string, b: string): string => {
  let result = '';
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) break;
    result += a[i];
  }
  return result;
};

export const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

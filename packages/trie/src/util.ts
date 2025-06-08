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

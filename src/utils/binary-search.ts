export const binarySearch = (
  needle: any, 
  haystack: any[], 
  returnClosestIndex = false,
  getItem: (item: any) => any = (x) => x,
  low = 0, 
  high: null | number = null, 
): any => {
  if (haystack.length === 0) {
    if (returnClosestIndex) {
      return 0
    }

    throw new Error('Not found')
  }

  if (high === null) {
    high = Math.max(haystack.length - 1, 0)
  }

  if (low > high || haystack.length === 0) {
    if (returnClosestIndex) {
      return low < haystack.length && needle >= getItem(haystack[low]) ? low + 1 : low
    }

    throw new Error('Not found')
  }

  const mid = low + Math.floor((high - low) / 2)
  const item = getItem(haystack[mid])

  if (needle === item) {
    return mid
  }

  if (needle > item) {
    return binarySearch(needle, haystack, returnClosestIndex, getItem, mid + 1, high)
  }

  if (needle < item) {
    return binarySearch(needle, haystack, returnClosestIndex, getItem, low, high - 1)
  }
}

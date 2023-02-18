export const binarySearch = (
  needle: any, 
  haystack: any[], 
  returnClosestIndex = false,
  getItem: (item: any) => any = (x) => x,
  low = 0, 
  high: null | number = null, 
): number => {
  if (high === null) {
    high = haystack.length - 1
  }

  let mid = 0
  let value
  while (low <= high) {
    mid = low + Math.floor((high - low) / 2)
    value = getItem(haystack[mid])
    
    if (value < needle) {
      low = mid + 1
    } else if (value > needle) {
      high = mid - 1
    } else {
      return mid
    }
  }

  if (returnClosestIndex) {
    return typeof value === 'number' && value < needle ? mid + 1 : mid 
  }

  return -1
}

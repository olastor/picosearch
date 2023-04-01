import { CompactRange } from '../interfaces'

// https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore#_get
export const get = (obj: object, path: string, defaultValue = undefined) => {
  const travel = (regexp: any) =>
    String.prototype.split
      .call(path, regexp)
      .filter(Boolean)
      .reduce((res: any, key: string) => (res !== null && res !== undefined ? res[key] : res), obj);
  const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);
  return result === undefined || result === obj ? defaultValue : result;
};

export const intersection = (arrays: any[][]): any[] => arrays.reduce(function(a, b) {
  return a.filter(function(value) {
    return b.includes(value);
  });
})

export const union = (arrays: any[][]): any[] => [...new Set(arrays.flatMap(a => a))]

export const randomInt = (max: number = Number.MAX_SAFE_INTEGER) => Math.floor(Math.random() * max)

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')


export const compactRangeAdd = (n: number, compactRange: CompactRange) => {
  if (n > compactRange.max) {
    compactRange.max = n
  } else if (n < compactRange.min) {
    compactRange.min = n
  }
}

export const compactRangeDelete = (n: number, compactRange: CompactRange) => {
  compactRange.missing.push(n)
  // TODO: "balance", i.e., update bounds and prevent missing array to become unnecessarily large 
}

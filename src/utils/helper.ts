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

export const cloneDeep = (obj: any) => JSON.parse(JSON.stringify(obj))

import type { TrieNode, TrieNodeMinified } from './interfaces';

export const invertMapping = (
  mapping: Record<string, string>,
): Record<string, string> =>
  Object.fromEntries(Object.entries(mapping).map(([k, v]) => [v, k]));

export const minifyTrieNode = <T>(node: TrieNode<T>): TrieNodeMinified<T> => {
  const newNode = {
    c: {} as { [part: string]: TrieNodeMinified<T> },
    v: node.values,
  };
  for (const [str, child] of Object.entries(node.children)) {
    newNode.c[str] = minifyTrieNode(child);
  }
  return newNode;
};

export const expandTrieNode = <T>(node: TrieNodeMinified<T>): TrieNode<T> => {
  const newNode = {
    children: {} as { [part: string]: TrieNode<T> },
    values: node.v,
  };
  for (const [str, child] of Object.entries(node.c)) {
    newNode.children[str] = expandTrieNode(child);
  }
  return newNode;
};

export const getJsonKeyReplacer =
  (keyMapping: Record<string, string>) =>
  (key: string, value: any): any => {
    if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [keyMapping?.[k] ?? k, v]),
      );
    }

    return value;
  };

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

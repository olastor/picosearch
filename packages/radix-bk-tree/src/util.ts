import { NODE_KEYS } from './constants';
import type {
  MinifiedNode,
  MinifiedNodeEntry,
  RadixBKTreeMapNode,
  RadixEdge,
} from './types';

/**
 * Get a BK child of a node.
 *
 * @param node - The node to get the child from.
 * @param key - The key of the child.
 * @returns The child node, or undefined if the key does not exist.
 */
export const getBKChild = <T>(
  node: RadixBKTreeMapNode<T>,
  key: number,
): RadixBKTreeMapNode<T> | undefined => {
  return node[NODE_KEYS.BK_CHILDREN]?.[key];
};

/**
 * Add a radix child reference to a node.
 *
 * @param source - The source node.
 * @param label - The label of the edge.
 * @param target - The target node.
 */
export const addRadixChild = <T>(
  source: RadixBKTreeMapNode<T>,
  label: string,
  target: RadixBKTreeMapNode<T>,
) => {
  source.r ??= [] as RadixEdge<T>[];
  const edge = [source, label, target] as RadixEdge<T>;
  sortedInsert(source.r, edge, (a, b) => a[1].localeCompare(b[1]));
  if (!target[NODE_KEYS.IS_ROOT]) {
    target[NODE_KEYS.PARENT] = edge;
  }
};

/**
 * Add a BK child reference to a node.
 *
 * @param source - The source node.
 * @param label - The label of the edge.
 * @param target - The target node.
 */
export const addBKChild = <T>(
  source: RadixBKTreeMapNode<T>,
  label: number,
  target: RadixBKTreeMapNode<T>,
) => {
  source.k ??= Object.create(null) as Record<number, RadixBKTreeMapNode<T>>;
  source.k[label] = target;
};

/**
 * Get the word associated with a node by traversing up the tree to reconstruct it.
 *
 * @param node - The node to get the word for.
 * @returns The word associated with the node.
 */
export const getNodeWord = <T>(node: RadixBKTreeMapNode<T>): string => {
  const word: string[] = [];
  let currentNode: RadixBKTreeMapNode<T> | undefined = node;
  while (currentNode[NODE_KEYS.PARENT]) {
    const edge = currentNode[NODE_KEYS.PARENT];
    assert(!!edge, 'Node must have a parent');
    word.unshift(edge[1]);
    currentNode = edge[0] as RadixBKTreeMapNode<T>;
  }
  return word.join('');
};

/**
 * Add values to a node. No duplicate check is performed.
 *
 * @param node - The node to add values to.
 * @param values - The values to add.
 */
export const addValues = <T>(node: RadixBKTreeMapNode<T>, values: T[]) => {
  if (!values?.length) return;
  node.v ??= [];
  node.v.push(...values);
};

/**
 * Get the common prefix of two strings.
 *
 * @param a - The first string.
 * @param b - The second string.
 * @returns The common prefix of the two strings.
 */
export const getCommonPrefix = (a: string, b: string): string => {
  let result = '';
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) break;
    result += a[i];
  }
  return result;
};

/**
 * Check if a node is a radix leaf. A radix leaf is a node that has at least one value associated with it.
 *
 * @param node - The node to check.
 * @returns True if the node is a radix leaf, false otherwise.
 */
export const isRadixLeaf = <T>(node: RadixBKTreeMapNode<T>): boolean => {
  return !!node[NODE_KEYS.VALUES]?.length;
};

/**
 * Traverses the radix tree and visit every leaf node.
 *
 * @param node - The node to traverse.
 * @param visit - The visit function.
 * @param prefix - The prefix to use (for recursion).
 */
export const traverseRadix = <T>(
  node: RadixBKTreeMapNode<T>,
  visit: (node: RadixBKTreeMapNode<T>, word: string, stop: () => void) => void,
  prefix = '',
) => {
  const stack: { node: RadixBKTreeMapNode<T>; prefix: string }[] = [
    { node, prefix },
  ];

  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) return;
    const { node, prefix } = next;
    if (isRadixLeaf(node)) {
      let stopped = false;
      visit(node, prefix, () => {
        stopped = true;
      });
      if (stopped) return;
    }
    const edges = node[NODE_KEYS.RADIX_CHILDREN];
    if (!edges) continue;
    for (let i = edges.length - 1; i >= 0; i--) {
      const [, edgeLabel, childNode] = edges[i];
      stack.push({
        node: childNode as RadixBKTreeMapNode<T>,
        prefix: prefix + edgeLabel,
      });
    }
  }
};

/**
 * Asserts that a condition is true.
 *
 * @param condition - The condition to assert.
 * @param message - The error message to throw if the condition is false.
 * @throws Will throw an error if the condition is false.
 */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/**
 * Serialize a RadixBKTreeMapNode to a compact array-based format.
 *
 * @param root - The root node to serialize.
 * @returns The serialized array.
 */
export const toMinifiedNode = <T>(
  root: RadixBKTreeMapNode<T>,
): MinifiedNode<T> => {
  const nodeToIndex = new Map<RadixBKTreeMapNode<T>, number>();
  const nodes: MinifiedNode<T> = [];
  function visit(node: RadixBKTreeMapNode<T>): number {
    const nodeIndex = nodeToIndex.get(node);
    if (nodeIndex !== undefined) return nodeIndex;
    const idx = nodes.length;
    nodeToIndex.set(node, idx);
    const entry: MinifiedNodeEntry<T> = {};
    nodes.push(entry);

    if (node.b) {
      entry.b = visit(node.b);
    }

    // Radix children
    const radixEdges = node[NODE_KEYS.RADIX_CHILDREN];
    if (radixEdges && radixEdges.length > 0) {
      entry.r = [];
      for (const [, edgeLabel, childNode] of radixEdges) {
        entry.r.push([edgeLabel, visit(childNode as RadixBKTreeMapNode<T>)]);
      }
    }

    // BK children
    const bkChildren = node[NODE_KEYS.BK_CHILDREN];
    if (bkChildren && Object.keys(bkChildren).length > 0) {
      entry.k = {};
      for (const distance of Object.keys(bkChildren).map(Number)) {
        entry.k[distance] = visit(bkChildren[distance]);
      }
    }
    // Values
    if (node.v && node.v.length > 0) {
      entry.v = node.v;
    }

    return idx;
  }
  visit(root);
  return nodes;
};

/**
 * Deserialize a compact array-based format to a RadixBKTreeMapNode.
 *
 * @param nodes - The array to deserialize.
 * @returns The deserialized node.
 */
export const fromMinifiedNode = <T>(
  nodes: MinifiedNode<T>,
): RadixBKTreeMapNode<T> => {
  const idxToNode = new Array<RadixBKTreeMapNode<T>>(nodes.length);
  function build(idx: number): RadixBKTreeMapNode<T> {
    if (idxToNode[idx]) return idxToNode[idx];
    const entry = nodes[idx];
    const node: RadixBKTreeMapNode<T> = {};
    idxToNode[idx] = node;
    // Radix children
    if (entry.r) {
      node.r = [];
      for (const [label, childIdx] of entry.r) {
        const childNode = build(childIdx);
        const edge: RadixEdge<T> = [node, label, childNode];
        node.r.push(edge);
        // Parent assignment should be fine as childNode is already in memo or being built
        if (!childNode[NODE_KEYS.IS_ROOT]) {
          // IS_ROOT check might be redundant if root is handled
          childNode[NODE_KEYS.PARENT] = edge;
        }
      }
    }

    // BK children
    if (entry.k) {
      node.k = {};
      for (const [distance, childIdx] of Object.entries(entry.k)) {
        node.k[Number(distance)] = build(childIdx);
      }
    }
    // Values
    if (entry.v) {
      node.v = entry.v;
    }
    if (entry.b) {
      node.b = build(entry.b);
    }
    return node;
  }
  return build(0);
};

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

/**
 * Check if two radix trees are equal. Only used for testing.
 *
 * @param a - The first tree.
 * @param b - The second tree.
 * @returns True if the trees are equal, false otherwise.
 */
const isEqualRadixTree = <T>(
  a: RadixBKTreeMapNode<T>,
  b: RadixBKTreeMapNode<T>,
) => {
  if (a.r?.length !== b.r?.length) return false;
  if (a[NODE_KEYS.IS_ROOT] !== b[NODE_KEYS.IS_ROOT]) return false;
  if (
    JSON.stringify(a[NODE_KEYS.VALUES]) !== JSON.stringify(b[NODE_KEYS.VALUES])
  )
    return false;

  for (let i = 0; i < (a.r?.length ?? 0); i++) {
    // @ts-expect-error
    if (a.r[i][0] !== a) return false;
    // @ts-expect-error
    if (a.r[i][1] !== b.r[i][1]) return false;
    // @ts-expect-error
    if (!isEqualRadixTree(a.r[i][2], b.r[i][2])) return false;
  }

  return true;
};

/**
 * Check if two BK trees are equal. Only used for testing.
 *
 * @param a - The first tree.
 * @param b - The second tree.
 * @returns True if the trees are equal, false otherwise.
 */
const isEqualBKTree = <T>(
  a: RadixBKTreeMapNode<T>,
  b: RadixBKTreeMapNode<T>,
) => {
  if (a.r?.length !== b.r?.length) return false;
  if (a[NODE_KEYS.IS_ROOT] !== b[NODE_KEYS.IS_ROOT]) return false;
  const aBKKeys = Object.keys(a[NODE_KEYS.BK_CHILDREN] ?? {});
  const bBKKeys = Object.keys(b[NODE_KEYS.BK_CHILDREN] ?? {});
  if (aBKKeys.length !== bBKKeys.length) return false;
  if (!aBKKeys.every((key) => bBKKeys.includes(key))) return false;

  if (!!a.b !== !!b.b || (a.b && b.b && !isEqualBKTree(a.b, b.b))) return false;

  for (const [key, value] of Object.entries(a[NODE_KEYS.BK_CHILDREN] ?? {})) {
    // @ts-expect-error
    if (!isEqualBKTree(value, b.k?.[Number(key)])) return false;
  }

  return true;
};

/**
 * Check if two trees are equal. Only used for testing.
 *
 * @param a - The first tree.
 * @param b - The second tree.
 * @returns True if the trees are equal, false otherwise.
 */
export const isEqualTreeStrict = <T>(
  a: RadixBKTreeMapNode<T>,
  b: RadixBKTreeMapNode<T>,
) => {
  return isEqualRadixTree(a, b) && isEqualBKTree(a, b);
};

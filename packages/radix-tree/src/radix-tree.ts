import { FUZZY_SEARCH_DEFAULT_MAX_ERROR } from './constants';
import type {
  IFuzzySearchOptions,
  IRadixTree,
  IRadixTreeMap,
  RadixTreeMapNode,
} from './types';
import { assert, getCommonPrefix, getNewEmptyNode, sortedInsert } from './util';

export class RadixTreeMap<T> implements IRadixTreeMap<T> {
  private root: RadixTreeMapNode<T>;

  constructor(root = getNewEmptyNode<T>()) {
    this.root = root;
  }

  /**
   * Inserts a key into the tree.
   *
   * @param key The key to insert.
   * @param values The values to associate with the key.
   */
  insert(key: string, ...values: T[]): void {
    assert(!!key && key.length > 0, 'Missing key!');

    let keyOffset = 0;
    let currentNode: RadixTreeMapNode<T> | null = this.root;

    while (currentNode) {
      const children: RadixTreeMapNode<T>[0] = currentNode[0];

      currentNode = null;
      for (const [edgeLabel, childNode] of Object.entries(children)) {
        const commonPrefix = getCommonPrefix(edgeLabel, key.slice(keyOffset));
        if (!commonPrefix) continue;
        keyOffset += commonPrefix.length;
        assert(keyOffset <= key.length, 'Unexpected key offset overflow');
        assert(
          commonPrefix.length <= edgeLabel.length,
          'Unexpected prefix length overflow',
        );
        if (commonPrefix.length === edgeLabel.length) {
          if (keyOffset === key.length) {
            childNode[1] ??= [];
            childNode[1].push(...values);
            return;
          }

          currentNode = childNode;
          break;
        }

        // partial match => split the edge
        children[commonPrefix] = getNewEmptyNode();
        const suffixOld = edgeLabel.slice(commonPrefix.length);
        children[commonPrefix][0][suffixOld] = childNode;
        delete children[edgeLabel];

        const suffixNew = key.slice(keyOffset);
        if (suffixNew.length) {
          children[commonPrefix][0][suffixNew] = getNewEmptyNode();
          children[commonPrefix][0][suffixNew][1] ??= [];
          children[commonPrefix][0][suffixNew][1].push(...values);
        } else {
          children[commonPrefix][1] ??= [];
          children[commonPrefix][1].push(...values);
        }
        return;
      }

      if (!currentNode) {
        // none of the children match
        const suffix = key.slice(keyOffset);
        children[suffix] = getNewEmptyNode<T>();
        children[suffix][1] ??= [];
        children[suffix][1].push(...values);
      }
    }
  }

  /**
   * Returns the values for the given key.
   *
   * @param key The key to look up.
   * @returns The values for the given key or null if the key is not found.
   */
  lookup(key: string): T[] | null {
    if (!key?.length) return null;

    let keyOffset = 0;
    let currentNode: RadixTreeMapNode<T> | null = this.root;

    while (currentNode) {
      const children: RadixTreeMapNode<T>[0] = currentNode[0];
      currentNode = null;
      for (const [edgeLabel, childNode] of Object.entries(children)) {
        const commonPrefix = getCommonPrefix(edgeLabel, key.slice(keyOffset));
        if (!commonPrefix) continue;
        assert(
          commonPrefix.length <= edgeLabel.length,
          'Unexpected prefix length overflow',
        );
        if (commonPrefix.length === edgeLabel.length) {
          keyOffset += commonPrefix.length;
          assert(keyOffset <= key.length, 'Unexpected key offset overflow');
          if (keyOffset === key.length) return childNode[1] ?? null;
          currentNode = childNode;
          break;
        }

        // the key matches only a part of the edge
        return null;
      }
    }

    return null;
  }

  /**
   * Returns the fuzzy matches for the given query.
   *
   * Please note that a RadixTree is not optimized for fuzzy search and this function implements a
   * dynamic programming approach to compute the edit distance for each path in the tree. This
   * approach is faster than a naive implementation, but for larger data sets you should consider
   * using other data structures like a BK-Tree.
   *
   * @param query The query to search for.
   * @param options The options to use for the search.
   * @returns The fuzzy matches for the given query.
   */
  getFuzzyMatches(
    query: string,
    options?: IFuzzySearchOptions & { includeValues?: false },
  ): string[];

  /**
   * Returns the fuzzy matches for the given query including the values.
   *
   * Please note that a RadixTree is not optimized for fuzzy search and this function implements a
   * dynamic programming approach to compute the edit distance for each path in the tree. This
   * approach is faster than a naive implementation, but for larger data sets you should consider
   * using other data structures like a BK-Tree.
   *
   * @param query The query to search for.
   * @param options The options to use for the search.
   * @returns The fuzzy matches for the given query including the values.
   */
  getFuzzyMatches(
    query: string,
    options?: IFuzzySearchOptions & { includeValues: true },
  ): [string, T[]][];

  getFuzzyMatches(
    query: string,
    options?: IFuzzySearchOptions,
  ): [string, T[]][] | string[] {
    if (!query?.length) return [];

    const maxErrors = options?.maxErrors ?? FUZZY_SEARCH_DEFAULT_MAX_ERROR;

    if (maxErrors === 0) {
      // this case equals a regular non-fuzzy search...
      const values = this.lookup(query);
      if (values === null) return [];
      return [[query, values]];
    }

    const result: { match: string; distance: number; values: T[] }[] = [];

    // The following traverses the RadixTreeMap while computing the Edit distance for each path
    // using dynamic programming. In this matrix the query characters are column indices and
    // candidate words take the vertical axis. Only the last and the current row need to be
    // remembered for each pair of words.
    //
    // see https://repositorio.uchile.cl/bitstream/handle/2250/126168/Navarro_Gonzalo_Guided_tour.pdf (page 17)

    const stack: {
      prefix: string;
      prevRow: number[];
      node: RadixTreeMapNode<T>;
    }[] = [
      {
        prefix: '',
        // the first row in the matrix is just the sequence 0,1,..,sequence.length
        prevRow: Array.from({ length: query.length + 1 }, (_, i) => i),
        node: this.root,
      },
    ];

    traversal: while (true) {
      const currentItem = stack.shift();
      if (!currentItem) break;
      const { prefix, prevRow, node } = currentItem;

      for (const item of Object.entries(node[0])) {
        const [edgeLabel, childNode] = item as [string, RadixTreeMapNode<T>];
        let lastRow = prevRow;
        let newPrefix = prefix;

        let lastRowErrorsTooHigh = false;
        for (const char of edgeLabel.split('')) {
          newPrefix += char;
          const newRow = [newPrefix.length];

          for (let j = 1; j <= query.length; j++) {
            const charDist = query[j - 1] === char ? 0 : 1;
            const value = Math.min(
              lastRow[j - 1] + charDist,
              lastRow[j] + 1,
              newRow[j - 1] + 1,
            );
            newRow.push(value);
          }
          lastRow = newRow;
          lastRowErrorsTooHigh = lastRow.every((v) => v > maxErrors);
          if (lastRowErrorsTooHigh) break;
        }

        const childNodeValues = childNode?.[1];
        if (
          lastRow[lastRow.length - 1] <= maxErrors &&
          childNode &&
          childNodeValues &&
          childNodeValues.length > 0
        ) {
          sortedInsert(
            result,
            {
              match: newPrefix,
              distance: lastRow[lastRow.length - 1],
              values: childNodeValues,
            },
            (a, b) => {
              const diff = a.distance - b.distance;
              return diff === 0 ? a.match.localeCompare(b.match) : diff;
            },
          );

          if (options?.limit && result.length >= options.limit) break traversal;
        }

        if (!lastRowErrorsTooHigh) {
          stack.push({
            prefix: newPrefix,
            prevRow: lastRow,
            node: childNode,
          });
        }
      }
    }

    return options?.includeValues
      ? result.map((item) => [item.match, item.values] as [string, T[]])
      : result.map((item) => item.match);
  }

  toJSON(): string {
    return JSON.stringify(this.root);
  }

  static fromJSON<T>(jsonStr: string): RadixTreeMap<T> {
    return new RadixTreeMap<T>(JSON.parse(jsonStr));
  }
}

export class RadixTree implements IRadixTree {
  private tree: RadixTreeMap<1>;

  constructor(options?: { root?: RadixTreeMapNode<1> }) {
    this.tree = new RadixTreeMap<1>(options?.root ?? getNewEmptyNode<1>());
  }

  /**
   * Inserts a key into the tree.
   *
   * @param key The key to insert.
   */
  insert(key: string): void {
    this.tree.insert(key, 1);
  }

  /**
   * Checks if the tree contains the given key.
   *
   * @param key The key to check.
   * @returns Whether the tree contains the given key.
   */
  has(key: string): boolean {
    return this.tree.lookup(key) !== null;
  }

  /**
   * Returns the fuzzy matches for the given query.
   *
   * @param query The query to search for.
   * @param options The options to use for the search.
   * @returns The fuzzy matches for the given query.
   */
  getFuzzyMatches(
    query: string,
    options?: Omit<IFuzzySearchOptions, 'includeValues'>,
  ): string[] {
    return this.tree.getFuzzyMatches(query, {
      includeValues: false,
      ...options,
    });
  }

  toJSON(): string {
    return this.tree.toJSON();
  }

  static fromJSON(jsonStr: string): RadixTree {
    return new RadixTree({
      root: JSON.parse(jsonStr),
    });
  }
}

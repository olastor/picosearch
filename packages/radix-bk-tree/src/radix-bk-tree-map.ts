import { FUZZY_SEARCH_DEFAULT_MAX_ERROR, NODE_KEYS } from './constants';
import { getEditDistance } from './levensthein';
import type {
  DistanceFunction,
  IFuzzySearchOptions,
  IPrefixSearchOptions,
  IRadixBKTreeMap,
  MinifiedNode,
  RadixBKTreeMapNode,
  RadixEdge,
} from './types';
import {
  assert,
  addBKChild,
  addRadixChild,
  addValues,
  compareFirstCharOfEdge,
  fromMinifiedNode,
  getBKChild,
  getCommonPrefix,
  getNodeWord,
  sortedFindIndex,
  sortedInsert,
  toMinifiedNode,
  traverseRadix,
} from './util';

export class RadixBKTreeMap<T> implements IRadixBKTreeMap<T> {
  protected root: RadixBKTreeMapNode<T>;
  private getDistance: DistanceFunction = getEditDistance;

  constructor(
    {
      getDistance,
      root,
    }: { getDistance?: DistanceFunction; root?: RadixBKTreeMapNode<T> } = {
      getDistance: getEditDistance,
    },
  ) {
    if (getDistance) {
      this.getDistance = getDistance;
    }
    this.root = root ?? (Object.create(null) as RadixBKTreeMapNode<T>);
    this.root[NODE_KEYS.IS_ROOT] = true;
  }

  private _insertBK(word: string, wordNode: RadixBKTreeMapNode<T>): void {
    if (wordNode[NODE_KEYS.IS_ROOT]) return;
    this.root[NODE_KEYS.BK_ROOT] ??= wordNode;
    let currentNode = this.root[NODE_KEYS.BK_ROOT];

    while (currentNode && currentNode !== wordNode) {
      const dist = this.getDistance(word, getNodeWord(currentNode));
      // word is already in tree
      if (dist === 0) return;
      const bkChild = getBKChild(currentNode, dist);
      if (!bkChild) {
        addBKChild(currentNode, dist, wordNode);
        return;
      }
      currentNode = bkChild;
    }
  }

  private _insert(key: string, insertBK: boolean, values: T[] = []): void {
    assert(!!key && key.length > 0, 'Missing key!');

    let keyOffset = 0;
    let currentNode: RadixBKTreeMapNode<T> | null = this.root;

    while (currentNode) {
      const edges = currentNode[NODE_KEYS.RADIX_CHILDREN];

      const currentNodeSaved = currentNode;

      currentNode = null;

      const remainingKey = key.slice(keyOffset);
      const matchingEdgeIndex = sortedFindIndex(
        edges || [],
        [null, remainingKey, null] as unknown as RadixEdge<T>,
        compareFirstCharOfEdge,
      );
      if (edges && matchingEdgeIndex !== -1) {
        const [, edgeLabel, childNode] = edges[matchingEdgeIndex];
        const commonPrefix = getCommonPrefix(edgeLabel, remainingKey);
        keyOffset += commonPrefix.length;
        assert(keyOffset <= key.length, 'Unexpected key offset overflow');
        assert(
          commonPrefix.length <= edgeLabel.length,
          'Unexpected prefix length overflow',
        );

        const isPartialMatch = commonPrefix.length < edgeLabel.length;
        if (!isPartialMatch) {
          const isFinalMatch = keyOffset === key.length;
          if (isFinalMatch) {
            // word is already in tree
            addValues(childNode, values);
            if (insertBK) this._insertBK(key, childNode);
            return;
          }

          currentNode = childNode as RadixBKTreeMapNode<T>;
        } else {
          // partial match => split the edge
          const oldWordNode = childNode;
          const newIntermediateNode = Object.create(
            null,
          ) as RadixBKTreeMapNode<T>;
          const suffixOld = edgeLabel.slice(commonPrefix.length);
          const suffixNew = key.slice(keyOffset);

          edges.splice(matchingEdgeIndex, 1);
          addRadixChild(currentNodeSaved, commonPrefix, newIntermediateNode);
          addRadixChild(newIntermediateNode, suffixOld, oldWordNode);

          let newWordNode = newIntermediateNode;
          if (suffixNew.length) {
            newWordNode = Object.create(null) as RadixBKTreeMapNode<T>;
            addRadixChild(newIntermediateNode, suffixNew, newWordNode);
          }

          addValues(newWordNode, values);

          if (insertBK) this._insertBK(key, newWordNode);

          return;
        }
      }

      if (!currentNode) {
        const newNode = Object.create(null) as RadixBKTreeMapNode<T>;
        const newPartialKey = key.slice(keyOffset);
        addRadixChild(currentNodeSaved, newPartialKey, newNode);
        addValues(newNode, values);

        if (insertBK) {
          this._insertBK(key, newNode);
        }
      }
    }
  }

  /**
   * Insert a key with values into the tree.
   * This will insert the key with fuzzy search enabled.
   *
   * @example
   * ```ts
   * const tree = new RadixBKTreeMap<string>();
   * tree.insert('hello', 'world');
   * ```
   *
   * @param key - The key to insert.
   * @param values - The values to insert.
   */
  insert(key: string, ...values: T[]): void {
    this._insert(key, true, values);
  }

  /**
   * Insert a key with values into the tree.
   * This will insert the key with fuzzy search disabled.
   *
   * @example
   * ```ts
   * const tree = new RadixBKTreeMap<string>();
   * tree.insertNoFuzzy('hello', 'world');
   * ```
   *
   * @param key - The key to insert.
   * @param values - The values to insert.
   */
  insertNoFuzzy(key: string, ...values: T[]): void {
    this._insert(key, false, values);
  }

  /**
   * Lookup a key in the tree.
   *
   * @example
   * ```ts
   * const tree = new RadixBKTreeMap<string>();
   * tree.insert('hello', 'world');
   * tree.lookup('hello'); // ['world']
   * ```
   *
   * @param key - The key to lookup.
   * @returns The values associated with the key, or null if the key is not found.
   */
  lookup(key: string, returnNode?: false): T[] | null;

  /**
   * Lookup a key in the tree and return the node.
   *
   * @param key - The key to lookup.
   * @returns The node associated with the key, or null if the key is not found.
   */
  lookup(key: string, returnNode: true): RadixBKTreeMapNode<T> | null;

  lookup(
    key: string,
    returnNode?: boolean,
  ): RadixBKTreeMapNode<T> | T[] | null {
    if (!key?.length) return [];

    let keyOffset = 0;
    let currentNode: RadixBKTreeMapNode<T> | null = this.root;

    while (currentNode) {
      const edges = currentNode[NODE_KEYS.RADIX_CHILDREN];
      if (!edges) {
        return null;
      }

      currentNode = null;
      const edgeIndex = sortedFindIndex(
        edges,
        [
          null,
          key.slice(keyOffset, keyOffset + 1),
          null,
        ] as unknown as RadixEdge<T>,
        compareFirstCharOfEdge,
      );
      if (edgeIndex === -1) {
        return null;
      }
      const [, edgeLabel, childNode] = edges[edgeIndex];
      const commonPrefix = getCommonPrefix(edgeLabel, key.slice(keyOffset));
      if (commonPrefix.length !== edgeLabel.length) return null;
      keyOffset += commonPrefix.length;
      assert(keyOffset <= key.length, 'Unexpected key offset overflow');
      if (keyOffset === key.length)
        return returnNode ? childNode : (childNode[NODE_KEYS.VALUES] ?? null);
      currentNode = childNode as RadixBKTreeMapNode<T>;
    }

    return null;
  }

  /**
   * Get all keys that start with the given prefix.
   *
   * @example
   * ```ts
   * const tree = new RadixBKTreeMap<string>();
   * tree.insert('hello', 'world');
   * tree.getPrefixMatches('hel'); // ['hello']
   * ```
   *
   * @param prefix - The prefix to match.
   * @param options - Optional options to control the behavior of the function.
   * @returns An array of keys that start with the given prefix.
   */
  getPrefixMatches(
    prefix: string,
    options?: IPrefixSearchOptions<T> & { includeValues?: false },
  ): string[];

  /**
   * Get all keys together with their values that start with the given prefix.
   *
   * @example
   * ```ts
   * const tree = new RadixBKTreeMap<string>();
   * tree.insert('hello', 'world');
   * tree.getPrefixMatches('hel', { includeValues: true }); // [['hello', ['world']]]
   * ```
   *
   * @param prefix - The prefix to match.
   * @param options - Optional options to control the behavior of the function.
   * @returns An array of keys together with their values that start with the given prefix.
   */
  getPrefixMatches(
    prefix: string,
    options?: IPrefixSearchOptions<T> & { includeValues: true },
  ): [string, T[]][];

  getPrefixMatches(
    prefix: string,
    options?: IPrefixSearchOptions<T>,
  ): string[] | [string, T[]][] {
    assert(
      !options?.limit || options.limit > 0,
      'Invalid parameter "limit" provided!',
    );
    assert(typeof prefix === 'string', 'Invalid parameter "prefix" provided!');

    let prefixOffset = 0;
    let currentPrefix = '';
    let currentNode: RadixBKTreeMapNode<T> | null = this.root;

    const result: string[] | [string, T[]][] = [];

    if (prefix !== '') {
      outer: while (currentNode) {
        const edges = currentNode[NODE_KEYS.RADIX_CHILDREN];
        if (!edges) {
          return result;
        }

        currentNode = null;
        for (const [, edgeLabel, childNode] of edges) {
          // the provided prefix must be a prefix of all returned value
          const commonPrefix = getCommonPrefix(
            edgeLabel,
            prefix.slice(prefixOffset),
          );
          if (!commonPrefix) continue;
          prefixOffset += commonPrefix.length;
          currentNode = childNode as RadixBKTreeMapNode<T>;
          currentPrefix += edgeLabel;
          if (prefixOffset >= prefix.length) {
            break outer;
          }
          break;
        }
      }
    }

    if (!currentNode) return result;

    // the expected prefix is fully consumed, now traverse the remaining tree
    // to collect all words with this prefix.
    traverseRadix(
      currentNode,
      (node, word, stop) => {
        if (options?.filter && !options.filter(node[NODE_KEYS.VALUES] || []))
          return;
        if (options?.includeValues) {
          (result as [string, T[]][]).push([
            word,
            node[NODE_KEYS.VALUES] || [],
          ]);
        } else {
          (result as string[]).push(word);
        }
        if (options?.limit && result.length >= options.limit) stop();
      },
      currentPrefix,
    );

    return result;
  }

  /**
   * Get all keys that are within the given distance of the query.
   *
   * @example
   * ```ts
   * const tree = new RadixBKTreeMap<string>();
   * tree.insert('hello', 'world');
   * tree.getFuzzyMatches('helo'); // ['hello']
   * ```
   *
   * @param query - The query to match.
   * @param options - Optional options to control the behavior of the function.
   * @returns An array of keys that are within the given edit distance of the query.
   */
  getFuzzyMatches(
    query: string,
    options?: IFuzzySearchOptions<T> & { includeValues?: false },
  ): string[];

  /**
   * Get all keys together with their values that are within the given distance of the query.
   *
   * @example
   * ```ts
   * const tree = new RadixBKTreeMap<string>();
   * tree.insert('hello', 'world');
   * tree.getFuzzyMatches('helo', { includeValues: true }); // [['hello', ['world']]]
   * ```
   *
   * @param query - The query to match.
   * @param options - Optional options to control the behavior of the function.
   * @returns An array of keys together with their values that are within the given edit distance of the query.
   */
  getFuzzyMatches(
    query: string,
    options?: IFuzzySearchOptions<T> & { includeValues: true },
  ): [string, T[]][];

  getFuzzyMatches(
    query: string,
    options?: IFuzzySearchOptions<T>,
  ): string[] | [string, T[]][] {
    assert(
      !options?.limit || options.limit > 0,
      'Invalid parameter "limit" provided!',
    );
    assert(
      !options?.maxErrors || options.maxErrors >= 0,
      'Invalid parameter "maxErrors" provided!',
    );

    const maxError = options?.maxErrors ?? FUZZY_SEARCH_DEFAULT_MAX_ERROR;

    const bkRoot = this.root[NODE_KEYS.BK_ROOT];
    if (!bkRoot)
      return options?.includeValues
        ? ([] as [string, T[]][])
        : ([] as string[]);
    const stack: RadixBKTreeMapNode<T>[] = [bkRoot];

    // result is ordered by distance ascending, with a maximum length of n
    const result: { word: string; distance: number; values: T[] }[] = [];
    while (stack.length > 0) {
      const currentNode = stack.shift();
      if (!currentNode) break; // let the compiler now it exists...
      const currentNodeWord = getNodeWord(currentNode);
      const dist = this.getDistance(currentNodeWord, query);
      if (
        dist <= maxError &&
        (!options?.filter ||
          options.filter(currentNode[NODE_KEYS.VALUES] || []))
      ) {
        sortedInsert(
          result,
          {
            word: currentNodeWord,
            distance: dist,
            values: currentNode[NODE_KEYS.VALUES] ?? [],
          },
          (a, b) => {
            const diff = a.distance - b.distance;
            return diff === 0 ? a.word.localeCompare(b.word) : diff;
          },
        );

        if (options?.limit && result.length > options.limit) result.pop();
      }

      for (const [distance, child] of Object.entries(
        currentNode[NODE_KEYS.BK_CHILDREN] ?? {},
      )) {
        if (Number(distance) - dist <= maxError) {
          stack.push(child);
        }
      }
    }

    return options?.includeValues
      ? result.map(({ word, values }) => [word, values] as [string, T[]])
      : result.map(({ word }) => word);
  }

  /**
   * Convert the tree to a JSON-serializable minified array representation.
   */
  toMinified(): MinifiedNode<T> {
    return toMinifiedNode(this.root);
  }

  /**
   * Convert the tree to a JSON-seralized string representation.
   */
  toJSON(): string {
    return JSON.stringify(this.toMinified());
  }

  /**
   * Create a new tree from a minified array representation.
   */
  static fromMinified<T>(minified: MinifiedNode<T>): RadixBKTreeMap<T> {
    return new RadixBKTreeMap<T>({
      root: fromMinifiedNode<T>(minified),
    });
  }

  /**
   * Create a new tree from a JSON-serialized string.
   */
  static fromJSON<T>(jsonStr: string): RadixBKTreeMap<T> {
    return RadixBKTreeMap.fromMinified(JSON.parse(jsonStr));
  }
}

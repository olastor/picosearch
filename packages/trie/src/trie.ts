import { FUZZY_SEARCH_DEFAULT_MAX_ERROR } from './constants';
import type {
  IFuzzySearchOptions,
  ITrie,
  ITrieMap,
  TrieMapNode,
} from './types';
import { sortedInsert } from './util';

const getNewEmptyNode = <T>(): TrieMapNode<T> => [
  Object.create(null) as TrieMapNode<T>[0],
];

export class TrieMap<T> implements ITrieMap<T> {
  private root: TrieMapNode<T>;

  constructor(root = getNewEmptyNode<T>()) {
    this.root = root;
  }

  /**
   * Insert values into the TrieMap for the given key. You can pass multiple values.
   *
   * @param key - The key to insert.
   * @param values - The values associated with the key.
   */
  insert(key: string, ...values: T[]): void {
    if (!key?.length) return;
    let currentNode = this.root;

    for (const part of key.split('')) {
      if (currentNode[0][part]) {
        currentNode = currentNode[0][part];
        continue;
      }

      currentNode[0][part] = getNewEmptyNode();
      currentNode = currentNode[0][part];
    }

    currentNode[1] ??= [];
    currentNode[1].push(...values);
  }

  /**
   * Lookup the values associated with the given key.
   *
   * @param key - The key to lookup.
   * @returns An array of values associated with the given key, or `null` if the key is not found.
   */
  lookup(query: string): T[] | null {
    if (!query?.length) return null;
    let currentNode = this.root;

    for (const part of query.split('')) {
      if (!currentNode[0][part]) {
        return null;
      }

      currentNode = currentNode[0][part];
    }

    return currentNode[1] ?? null;
  }

  /**
   * Get all words that match the given query.
   *
   * Please note that a Trie is not optimized for fuzzy search and this function implements a
   * dynamic programming approach to compute the edit distance for each path in the Trie. This
   * approach is faster than a naive implementation, but for larger data sets you should consider
   * using other data structures like a BK-Tree.
   *
   * @param query - The query to match.
   * @param options - Optional options to control the behavior of the function.
   * @returns An array of words that match the given query.
   */
  getFuzzyMatches(
    query: string,
    options?: IFuzzySearchOptions & { includeValues?: false },
  ): string[];

  /**
   * Get all words together with their values that match the given query.
   *
   * Please note that a Trie is not optimized for fuzzy search and this function implements a
   * dynamic programming approach to compute the edit distance for each path in the Trie. This
   * approach is faster than a naive implementation, but for larger data sets you should consider
   * using other data structures like a BK-Tree.
   *
   * @param query - The query to match.
   * @param options - Optional options to control the behavior of the function.
   * @returns An array of words together with their values that match the given query.
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

    if (options?.maxErrors === 0) {
      // this case equals a regular non-fuzzy search...
      const values = this.lookup(query);
      if (values === null) return [];
      return options?.includeValues ? [[query, values]] : [query];
    }

    const maxErrors = options?.maxErrors ?? FUZZY_SEARCH_DEFAULT_MAX_ERROR;

    const result: [word: string, distance: number, values: T[]][] = [];

    const stack: {
      prefix: string;
      prevRow: number[];
      node: TrieMapNode<T>;
    }[] = [
      {
        prefix: '',
        // the first row in the matrix is just the sequence 0,1,..,sequence.length
        prevRow: Array.from({ length: query.length + 1 }, (_, i) => i),
        node: this.root,
      },
    ];

    // The following traverses the Trie while computing the Edit distance for each path using dynamic
    // programming.
    // see https://repositorio.uchile.cl/bitstream/handle/2250/126168/Navarro_Gonzalo_Guided_tour.pdf (page 17)

    while (true) {
      const currentItem = stack.shift();
      if (!currentItem) break;
      const { prefix, prevRow, node } = currentItem;

      for (const item of Object.entries(node[0])) {
        const [char, childNode] = item as [string, TrieMapNode<T>];
        const newPrefix = prefix + char;
        const newRow = [newPrefix.length];
        let allValuesInRowExceedMaxError = newRow[0] > maxErrors;
        for (let j = 1; j <= query.length; j++) {
          const charDist = query[j - 1] === char ? 0 : 1;
          const value = Math.min(
            prevRow[j - 1] + charDist,
            prevRow[j] + 1,
            newRow[j - 1] + 1,
          );
          newRow.push(value);

          if (allValuesInRowExceedMaxError && value <= maxErrors) {
            allValuesInRowExceedMaxError = false;
          }
        }

        if (childNode?.[1] && newRow[newRow.length - 1] <= maxErrors) {
          const distance = newRow[newRow.length - 1];
          sortedInsert<[string, number, T[]]>(
            result,
            [newPrefix, distance, childNode[1]],
            (a, b) => {
              const diff = a[1] - b[1];
              return diff === 0 ? a[0].localeCompare(b[0]) : diff;
            },
          );

          if (options?.limit && result.length >= options.limit) break;
        }

        if (!allValuesInRowExceedMaxError) {
          stack.push({
            prefix: newPrefix,
            prevRow: newRow,
            node: childNode,
          });
        }
      }
    }

    return options?.includeValues
      ? result.map(
          ([word, distance, values]) => [word, values] as [string, T[]],
        )
      : result.map(([word]) => word);
  }

  toJSON(): string {
    return JSON.stringify(this.root);
  }

  static fromJSON<T>(jsonStr: string): TrieMap<T> {
    return new TrieMap<T>(JSON.parse(jsonStr));
  }
}

export class Trie implements ITrie {
  private trieMap: TrieMap<1>;

  constructor(options?: { root?: TrieMapNode<1> }) {
    this.trieMap = new TrieMap<1>(options?.root ?? getNewEmptyNode<1>());
  }

  /**
   * Insert a key into the Trie.
   *
   * @param key - The key to insert.
   */
  insert(key: string): void {
    if (this.has(key)) return;
    this.trieMap.insert(key, 1);
  }

  /**
   * Check if the Trie contains the given key.
   *
   * @param key - The key to check.
   * @returns `true` if the Trie contains the key, `false` otherwise.
   */
  has(key: string): boolean {
    return this.trieMap.lookup(key) !== null;
  }

  /**
   * Get all words that match the given query.
   *
   * @param query - The query to match.
   * @param options - Optional options to control the behavior of the function.
   * @returns An array of words that match the given query.
   */
  getFuzzyMatches(
    query: string,
    options?: Omit<IFuzzySearchOptions, 'includeValues'>,
  ): string[] {
    return this.trieMap.getFuzzyMatches(query, {
      ...options,
      includeValues: false,
    });
  }

  toJSON(): string {
    return this.trieMap.toJSON();
  }

  static fromJSON(jsonStr: string): Trie {
    return new Trie({ root: JSON.parse(jsonStr) });
  }
}

import { NODE_KEYS } from './constants';

export type RadixEdge<T> = [
  source: RadixBKTreeMapNode<T>,
  label: string,
  target: RadixBKTreeMapNode<T>,
];

export type RadixBKTreeMapNode<T> = {
  [NODE_KEYS.IS_ROOT]?: true;

  // the parent link is necessary to reconstruct a word when fuzzy searching
  [NODE_KEYS.PARENT]?: RadixEdge<T>;

  // this is the reference to the first inserted item, which is the root of the BK tree,
  // which is only set if parent is undefined (for the radix tree root).
  [NODE_KEYS.BK_ROOT]?: RadixBKTreeMapNode<T>;

  // TODO: check if this can be converted into a Record<string, RadixBKTreeMapNode<T>>
  //       with the current implementation.
  [NODE_KEYS.RADIX_CHILDREN]?: RadixEdge<T>[];

  [NODE_KEYS.BK_CHILDREN]?: Record<number, RadixBKTreeMapNode<T>>;
  [NODE_KEYS.VALUES]?: T[];
};

export type DistanceFunction = (a: string, b: string) => number;

export type FilterFunction<T> = (values: T[]) => boolean;

export interface IFuzzySearchOptions<T> {
  /**
   * The maximum number of errors to allow, i.e. the maximum edit distance.
   */
  maxErrors?: number;

  /**
   * The maximum number of results to return. When used, it is not guaranteed that the
   * returned results are the closest ones to the query.
   */
  limit?: number;

  /**
   * Whether to include the values in the results.
   */
  includeValues?: boolean;

  /**
   * A filter to apply to the values.
   */
  filter?: FilterFunction<T>;
}

export interface IPrefixSearchOptions<T> {
  /**
   * The maximum number of results to return.
   */
  limit?: number;

  /**
   * Whether to include the values in the results.
   */
  includeValues?: boolean;

  /**
   * A filter to apply to the values.
   */
  filter?: FilterFunction<T>;
}

export interface IRadixBKTreeMap<T> {
  insert: (key: string, ...values: T[]) => void;
  insertNoFuzzy: (key: string, ...values: T[]) => void;
  lookup: {
    (key: string, returnNode?: false): T[] | null;
    (key: string, returnNode: true): RadixBKTreeMapNode<T> | null;
  };
  getFuzzyMatches: {
    (
      query: string,
      options?: IFuzzySearchOptions<T> & { includeValues?: false },
    ): string[];
    (
      query: string,
      options?: IFuzzySearchOptions<T> & { includeValues: true },
    ): [string, T[]][];
  };
  getBatchFuzzyMatches: {
    (
      queries: string[],
      options?: IFuzzySearchOptions<T> & { includeValues?: false },
    ): string[];
    (
      queries: string[],
      options?: IFuzzySearchOptions<T> & { includeValues: true },
    ): [string, T[]][];
  };
  getPrefixMatches: {
    (
      prefix: string,
      options?: IPrefixSearchOptions<T> & { includeValues?: false },
    ): string[];
    (
      prefix: string,
      options?: IPrefixSearchOptions<T> & { includeValues: true },
    ): [string, T[]][];
  };
  toMinified: () => MinifiedNode<T>;
  toJSON: () => string;
}

export type MinifiedNodeEntry<T> = {
  b?: number;
  r?: [part: string, childIdx: number][];
  k?: { [distance: number]: number };
  v?: T[];
};
export type MinifiedNode<T> = MinifiedNodeEntry<T>[];

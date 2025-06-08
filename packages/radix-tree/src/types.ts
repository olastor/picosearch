export type RadixTreeMapNode<T> = [
  children: { [part: string]: RadixTreeMapNode<T> },
  values?: T[],
];

export interface IFuzzySearchOptions {
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
}

export interface IPrefixSearchOptions {
  /**
   * Whether to include the values in the results.
   */
  includeValues?: boolean;
}

export interface IRadixTreeMap<T> {
  insert: (key: string, ...values: T[]) => void;
  getFuzzyMatches: {
    (
      query: string,
      options?: IFuzzySearchOptions & { includeValues?: false },
    ): string[];
    (
      query: string,
      options?: IFuzzySearchOptions & { includeValues: true },
    ): [string, T[]][];
  };
  lookup: (key: string) => T[] | null;
  toJSON: () => string;
}

export interface IRadixTree {
  insert: (key: string) => void;
  getFuzzyMatches: (
    query: string,
    options?: Omit<IFuzzySearchOptions, 'includeValues'>,
  ) => string[];
  has: (key: string) => boolean;
  toJSON: () => string;
}

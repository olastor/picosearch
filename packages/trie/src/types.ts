export type TrieMapNode<T> = [
  children: { [part: string]: TrieMapNode<T> },
  values?: T[],
];

export interface IFuzzySearchOptions {
  maxErrors?: number;
  limit?: number;
  includeValues?: boolean;
}

export interface ITrieMap<T> {
  insert: (key: string, ...values: T[]) => void;
  lookup: (key: string) => T[] | null;
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
  toJSON: () => string;
}

export interface ITrie {
  insert: (key: string) => void;
  has: (key: string) => boolean;
  getFuzzyMatches: (
    query: string,
    options?: Omit<IFuzzySearchOptions, 'includeValues'>,
  ) => string[];
  toJSON: () => string;
}

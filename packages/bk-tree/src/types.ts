export type BKTreeNode = [word: string, children?: Record<number, BKTreeNode>];
export type DistanceFunction = (a: string, b: string) => number;

export interface IBKTree {
  insert: (word: string) => void;
  lookup: (query: string) => string | null;
  find: (
    query: string,
    options?: { maxError?: number; limit?: number },
  ) => string[];
  toJSON: () => string;
}

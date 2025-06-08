import { getEditDistance } from './levensthein';
import type { BKTreeNode, DistanceFunction, IBKTree } from './types';
import { sortedInsert } from './util';

const getNewNode = (word: string): BKTreeNode => [word];

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

export class BKTree implements IBKTree {
  private root: BKTreeNode;
  private getDistance: DistanceFunction = getEditDistance;

  constructor(
    {
      getDistance,
      root,
    }: { getDistance?: DistanceFunction; root?: BKTreeNode } = {
      getDistance: getEditDistance,
    },
  ) {
    if (getDistance) {
      this.getDistance = getDistance;
    }
    if (root) {
      this.root = root;
    }
  }

  /**
   * Insert a word into the tree.
   *
   * @param word - The word to insert.
   */
  insert(word: string): void {
    if (!this.root) {
      this.root = getNewNode(word);
      return;
    }

    let currentNode: BKTreeNode = this.root;

    while (currentNode) {
      const dist = this.getDistance(word, currentNode[0]);
      // word is already in tree
      if (dist === 0) return;
      currentNode[1] ??= Object.create(null) as Record<number, BKTreeNode>;
      if (!currentNode[1][dist]) {
        currentNode[1][dist] = getNewNode(word);
        return;
      }
      currentNode = currentNode[1][dist];
    }
  }

  /**
   * Find all words in the tree that are within a given edit distance of the query.
   *
   * @param query - The query to find words for.
   * @param options - The options to use for the find operation.
   * @param options.maxError - The maximum edit distance.
   * @param options.limit - The maximum number of results to return.
   * @returns An array of words that are within the given edit distance of the query.
   */
  find(
    query: string,
    options?: { maxError?: number; limit?: number },
  ): string[] {
    const { maxError = Number.POSITIVE_INFINITY, limit } = options ?? {};
    assert(!limit || limit > 0, 'Invalid parameter "limit" provided!');
    assert(maxError >= 0, 'Invalid parameter "maxError" provided!');
    if (!this.root) return [];
    const stack: BKTreeNode[] = [this.root];

    // result is ordered by distance ascending, with a maximum length of n
    const result: { word: string; distance: number }[] = [];
    while (stack.length > 0) {
      const currentNode = stack.shift();
      if (!currentNode) break; // let the compiler now it exists...
      const dist = this.getDistance(currentNode[0], query);
      if (dist <= maxError) {
        sortedInsert(
          result,
          { word: currentNode[0], distance: dist },
          (a, b) => {
            const diff = a.distance - b.distance;
            return diff === 0 ? a.word.localeCompare(b.word) : diff;
          },
        );

        if (limit && result.length > limit) result.pop();
      }
      for (const [distance, child] of Object.entries(currentNode[1] ?? {})) {
        if (Number(distance) - dist <= maxError) {
          stack.push(child);
        }
      }
    }

    return result.map(({ word }) => word);
  }

  /**
   * Lookup the closest word to the query.
   *
   * @param query - The query to lookup.
   * @returns The closest word to the query, or `null` if the tree is empty.
   */
  lookup(query: string): string | null {
    if (!this.root) return null;
    return this.find(query, {
      maxError: Number.POSITIVE_INFINITY,
      limit: 1,
    })[0];
  }

  /**
   * Serialize the tree to a JSON string.
   *
   * @returns The serialized tree.
   */
  toJSON(): string {
    assert(!!this.root, 'Tree is empty');
    return JSON.stringify(this.root);
  }

  static fromJSON(jsonStr: string): BKTree {
    return new BKTree({
      root: JSON.parse(jsonStr) as BKTreeNode,
    });
  }
}

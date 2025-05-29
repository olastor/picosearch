import type {
  ITrie,
  TrieFuzzyMatch,
  TrieNode,
  TrieNodeMinified,
} from './interfaces';
import { getJsonKeyReplacer } from './util';

const getNewEmptyNode = <T>(): TrieNode<T> => ({
  children: {} as TrieNode<T>['children'],
  values: [],
});

const JSON_KEY_MAP: Record<string, string> = {
  children: 'c',
  values: 'v',
};

export class Trie<T> implements ITrie<T> {
  private root: TrieNode<T>;

  constructor(root = getNewEmptyNode<T>()) {
    this.root = root;
  }

  getRoot(): TrieNode<T> {
    return this.root;
  }

  insert(sequence: string[], values: T[]): void {
    if (!sequence?.length) return;
    let currentNode = this.root;

    for (const part of sequence) {
      if (currentNode.children[part]) {
        currentNode = currentNode.children[part];
        continue;
      }

      currentNode.children[part] = getNewEmptyNode();
      currentNode = currentNode.children[part];
    }

    currentNode.values.push(...values);
  }

  search(sequence: string[]): T[] {
    if (!sequence?.length) return [];
    let currentNode = this.root;

    for (const part of sequence) {
      if (!currentNode.children[part]) {
        return [];
      }

      currentNode = currentNode.children[part];
    }

    return currentNode.values;
  }

  fuzzySearch(
    sequence: string[],
    maxErrors = 3,
    //limit?: number,
  ): TrieFuzzyMatch<T>[] {
    if (!sequence?.length) return [];

    if (maxErrors === 0) {
      // this case equals a regular non-fuzzy search...
      const values = this.search(sequence);
      return values.length > 0
        ? [{ match: sequence.join(''), distance: 0, values }]
        : [];
    }

    const result: TrieFuzzyMatch<T>[] = [];

    const stack: {
      prefix: string;
      prevRow: number[];
      node: TrieNode<T>;
    }[] = [
      {
        prefix: '',
        // the first row in the matrix is just the sequence 0,1,..,sequence.length
        prevRow: Array.from({ length: sequence.length + 1 }, (_, i) => i),
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

      for (const [char, childNode] of Object.entries(node.children)) {
        const newPrefix = prefix + char;
        const newRow = [newPrefix.length];
        let allValuesInRowExceedMaxError = newRow[0] > maxErrors;
        for (let j = 1; j <= sequence.length; j++) {
          const charDist = sequence[j - 1] === char ? 0 : 1;
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

        if (
          childNode.values.length > 0 &&
          newRow[newRow.length - 1] <= maxErrors
        ) {
          result.push({
            match: newPrefix,
            distance: newRow[newRow.length - 1],
            values: childNode.values,
          });

          // TODO: figure out how to use limit to always include the items with the smallest distance
          //if (limit && result.length >= limit) break traversal;
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

    return result.sort((a, b) => {
      const diff = a.distance - b.distance;
      return diff === 0 ? a.match.localeCompare(b.match) : diff;
    });
  }

  toJSON(): string {
    return JSON.stringify(this.root, getJsonKeyReplacer(JSON_KEY_MAP));
  }

  static fromJSON<T>(jsonStr: string): Trie<T> {
    const invertMap = (obj: TrieNodeMinified<T>): TrieNode<T> => ({
      children: Object.fromEntries(
        Object.entries(obj.c).map(([k, v]) => [k, invertMap(v)]),
      ),
      values: obj.v,
    });
    const root = invertMap(JSON.parse(jsonStr));
    return new Trie<T>(root);
  }
}

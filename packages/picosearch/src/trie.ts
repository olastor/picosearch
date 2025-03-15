import type { ITrie, TrieNode } from './interfaces';
import { getJsonKeyReplacer, getJsonKeyReviver } from './util';

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

  toJSON(): string {
    return JSON.stringify(this.root, getJsonKeyReplacer(JSON_KEY_MAP));
  }

  static fromJSON<T>(jsonStr: string): Trie<T> {
    const root = JSON.parse(jsonStr, getJsonKeyReviver(JSON_KEY_MAP));
    return new Trie<T>(root);
  }
}

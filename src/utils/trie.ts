import { TrieNode } from '../interfaces'
import * as _ from './helper'

export const trieInsert = <T>(
  root: TrieNode<T>, 
  item: T, 
  sequence: string
) => {
  const chars = sequence.split('')
  let node = root
  for (const c of chars) {
    if (!node.c[c]) {
      const newNode: TrieNode<T> = { c: {}, items: [] }
      node.c[c] = newNode
      node = newNode
    } else {
      node = node.c[c]
    }
  }

  node.items.push(item)
}

export const trieSearch = <T>(
  root: TrieNode<T>, 
  sequence: string,
  requireTerminal = true
): TrieNode<T> | null => {
  const chars = sequence.split('')
  let node = root
  for (const c of chars) {
    if (typeof node.c[c] === 'undefined') {
      return null
    } else {
      node = node.c[c]
    }
  }

  return requireTerminal && node.items.length === 0 ? null : node
}

export const trieDelete = <T>(
  node: TrieNode<T>, 
  item: T,
  eql: (a: T, b: T) => boolean = (a, b) => a === b
): void => {
  if (node.items && node.items.length > 0) {
    node.items = node.items.filter(x => !eql(x, item))
  }

  if (node.c) {
    Object.values(node.c).forEach(n => trieDelete(n, item, eql))
  }
}

export const trieFuzzySearch = <T>(
  root: TrieNode<T>, 
  sequence: string,
  maxDistance = 3,
  prefixLength = 0
): [string, TrieNode<T>][] => {
  let node: TrieNode<T> | null = root
  const prefix = sequence.slice(0, prefixLength)
  if (prefixLength > 0) {
    node = trieSearch<T>(root, prefix, false)    

    if (node === null) {
      return []
    }
  }
  
  const recurse = (
    currentNode: TrieNode<T>, 
    currentDistance: number,
    currentSequence: string,
    charsLeft: string[]
  ): [string, TrieNode<T>][] => {
    if (currentDistance > maxDistance) {
      return []
    }

    if (Object.keys(currentNode.c).length === 0) {
      return currentNode.items.length > 0 ? [[currentSequence, currentNode]] : []
    }

    if (charsLeft.length === 0) {
      return [
        ...(currentNode.items.length > 0 ? [[currentSequence, currentNode] as [string, TrieNode<T>]] : []),
        ...Object.entries(currentNode.c)
          .flatMap(([c, n]) => 
            recurse(n, currentDistance + 1, currentSequence + c, [])
          )
      ]
    }

    let results = [
      // deletion
      ...recurse(currentNode, currentDistance + 1, currentSequence, charsLeft.slice(1))
    ]

    for (const [char, childNode] of Object.entries(currentNode.c)) {
      if (char === charsLeft[0]) {
        results = results.concat(recurse(childNode, currentDistance, currentSequence + char, charsLeft.slice(1)))
      } else {
        // insertion
        results = results.concat(recurse(childNode, currentDistance + 1, currentSequence + char, charsLeft))
        // substition
        results = results.concat(recurse(childNode, currentDistance + 1, currentSequence + char, charsLeft.slice(1)))
      }
    }

    return results
  }

  const chars = sequence.slice(prefixLength).split('')
  return recurse(node, 0, prefix, chars)
}

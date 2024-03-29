import { TrieNode } from '../interfaces'
import * as _ from './helper'

export const trieInsert = <T>(
  root: TrieNode<T>,
  item: T,
  sequence: string[]
) => {
  let node = root
  for (const c of sequence) {
    if (!node._c[c]) {
      const newNode: TrieNode<T> = { _c: {}, _d: [] }
      node._c[c] = newNode
      node = newNode
    } else {
      node = node._c[c]
    }
  }

  node._d.push(item)
}

export const trieSearch = <T>(
  root: TrieNode<T>,
  sequence: string[],
  requireTerminal = true
): TrieNode<T> | null => {
  let node = root
  for (const c of sequence) {
    if (typeof node._c[c] === 'undefined') {
      return null
    } else {
      node = node._c[c]
    }
  }

  return requireTerminal && node._d.length === 0 ? null : node
}

/**
 * Recursively delete a specific item from the whole tree.
 */
// export const trieDelete = <T>(
//   node: TrieNode<T>,
//   item: T,
//   eql: (a: T, b: T) => boolean = (a, b) => a === b
// ): void => {
//   if (node._d && node._d.length > 0) {
//     node._d = node._d.filter(x => !eql(x, item))
//   }

//   if (node._c) {
//     Object.values(node._c)
//       .forEach(n => trieDelete(n, item, eql))
//   }
// }

// export const trieFuzzySearch = <T>(
//   root: TrieNode<T>,
//   sequence: string[],
//   maxDistance = 3,
//   prefixLength = 0
// ): [string[], TrieNode<T>][] => {
//   let node: TrieNode<T> | null = root
//   const prefix = sequence.slice(0, prefixLength)
//   if (prefixLength > 0) {
//     node = trieSearch<T>(root, prefix, false)

//     if (node === null) {
//       return []
//     }
//   }

//   const recurse = (
//     currentNode: TrieNode<T>,
//     currentDistance: number,
//     currentSequence: string[],
//     charsLeft: string[]
//   ): [string[], TrieNode<T>][] => {
//     if (currentDistance > maxDistance) {
//       return []
//     }

//     if (Object.keys(currentNode._c).length === 0) {
//       return currentNode._d.length > 0 ? [[currentSequence, currentNode]] : []
//     }

//     if (charsLeft.length === 0) {
//       return [
//         ...(currentNode._d.length > 0 ? [[currentSequence, currentNode] as [string[], TrieNode<T>]] : []),
//         ...Object.entries(currentNode._c)
//           .flatMap(([c, n]) =>
//             recurse(n, currentDistance + 1, [...currentSequence, c], [])
//           )
//       ]
//     }

//     let results = [
//       // deletion
//       ...recurse(currentNode, currentDistance + 1, currentSequence, charsLeft.slice(1))
//     ]

//     for (const [char, childNode] of Object.entries(currentNode._c)) {
//       if (char === charsLeft[0]) {
//         results = results.concat(recurse(childNode, currentDistance, [...currentSequence, char], charsLeft.slice(1)))
//       } else {
//         // insertion
//         results = results.concat(recurse(childNode, currentDistance + 1, [...currentSequence, char], charsLeft))
//         // substition
//         results = results.concat(recurse(childNode, currentDistance + 1, [...currentSequence, char], charsLeft.slice(1)))
//       }
//     }

//     return results
//   }

//   const chars = sequence.slice(prefixLength)
//   return recurse(node, 0, prefix, chars)
// }

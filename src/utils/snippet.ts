const findIndex = (haystack: string, needle: string, start = 0): number => {
  const skipped = haystack.slice(start)
  const found = skipped.indexOf(needle)
  return found < 0 ? found : start + found
}

export const snippet = (
  highlightedText: string,
  tagBefore = '<em>',
  tagAfter = '</em>',
  minWindowSize = 100
): string[] => {
  if  (!highlightedText) return []

  let leftIndex = 0
  let rightIndex = 0
  const snippets = ['']

  // eslint-disable-next-line
  while (true) {
    const tagBeforeIndex = findIndex(highlightedText, tagBefore, rightIndex)
    if (tagBeforeIndex < 0) {
      break
    }

    const tagAfterIndex = findIndex(highlightedText, tagAfter, tagBeforeIndex)
    if (tagAfterIndex < 0) {
      break
    }

    leftIndex = tagBeforeIndex - minWindowSize
    if (leftIndex > 0) {
      const match = /\S+$/.exec(highlightedText.slice(0, leftIndex))
      if (match) {
        leftIndex -= match[0].length
      }
    }

    const isNewSnippet = rightIndex > 0 && leftIndex > rightIndex
    if (isNewSnippet) {
      snippets.push('')
    }

    let newRightIndex = tagAfterIndex + minWindowSize + tagAfter.length
    if (newRightIndex < highlightedText.length) {
      const match = /\S+/.exec(highlightedText.slice(newRightIndex))
      if (match) {
        newRightIndex += match[0].length
      }
    }

    snippets[snippets.length - 1] += highlightedText.slice(
      Math.max(leftIndex, rightIndex),
      newRightIndex
    )

    rightIndex = newRightIndex
  }

  return snippets.filter(s => s)
}

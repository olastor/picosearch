interface Options {
  tokenizer: (s: string) => string[];
  stemmer: null | ((s: string) => string);
  lowercase: boolean;
  stripPunctuation: boolean;
  customTransformation: null| ((s: string) => string);
  stopwords: string[];
  bm25: {
    k1: number
    b: number
  }
}

interface TextIndex {
  numOfDocs: number;
  docFreqsByToken: { [key: string]: [number, number][] };
  docLengths: { [key: string]: number };
  avgDocLength: number;
}

interface SearchResult {
  docId: number;
  score: number;
}

const DEFAULT_OPTIONS: Options = {
  tokenizer: (s: string): string[] => s.split(/\s+/g),
  stemmer: null,
  customTransformation: null,
  lowercase: true,
  stripPunctuation: true,
  stopwords: [],
  bm25: {
    k1: 2.0,
    b: 0.75
  }
}

const REGEXP_PATTERN_PUNCT = new RegExp("['!\"“”#$%&\\'()\*+,\-\.\/:;<=>?@\[\\\]\^_`{|}~']", 'g')
const stripPunctuation = (s: string): string => s.replace(REGEXP_PATTERN_PUNCT, '')

const preprocessText = (text: string, options: Options): string[] => {
  const tokens = options.tokenizer(text)
  const result: string[] = [] 

  for (const token of tokens) {
    let newToken = token.trim()

    if (!newToken) continue;

    if (options.customTransformation) {
      newToken = options.customTransformation(newToken)
    }

    if (options.stripPunctuation) {
      newToken = stripPunctuation(newToken)
    }

    if (!newToken) continue;

    if (options.stopwords && options.stopwords.length > 0 && options.stopwords.includes(newToken.toLowerCase())) {
      continue
    }

    if (options.lowercase) {
      newToken = newToken.toLowerCase()
    }

    if (options.stemmer) {
      newToken = options.stemmer(newToken)
    }
    
    if (newToken) {
      result.push(newToken) 
    }
  }

  return result
}

/**
  * Builds a new index to be used for searching a set of texts / documents.
  *
  *
  *
  */
export const buildSearchIndex = (docs: string[], options: Options = DEFAULT_OPTIONS): TextIndex => {
  const newIndex: TextIndex = {
    numOfDocs: docs.length,
    docFreqsByToken: {},
    docLengths: {},
    avgDocLength: 0
  }

  // build a mapping, listing occurrences of a token in documents, grouped by the token
  const docsByToken: { [key: string]: number[] } = {}
  docs.forEach((text: string, i: number) => {
    const tokens = preprocessText(text, options)

    newIndex.docLengths[i.toString()] = tokens.length
    newIndex.avgDocLength += tokens.length

    tokens.forEach(token => {
      if (typeof newIndex.docFreqsByToken[token] === 'undefined') {
        docsByToken[token] = []
      }
      docsByToken[token].push(i)
    })
  })

  newIndex.avgDocLength /= docs.length

  // transform the mapping to include the frequencies of documents
  Object.entries(docsByToken).forEach(([token, docIds]) => {
    const freqMap: { [key: string]: number } = {};
    docIds.forEach((docId) => {
      freqMap[docId] = (freqMap[docId] || 0) + 1
    })

    newIndex.docFreqsByToken[token] = Object.entries(freqMap).map(([docId, freq]) => [Number(docId), freq])
  })
  
  return newIndex
}

export const querySearchIndex = (query: string, index: TextIndex, options: Options, size = 10, docs: string[] = null): SearchResult[] => {
  // http://ipl.cs.aueb.gr/stougiannis/bm25.html
  const queryTokens = preprocessText(query, options)

  if (queryTokens.length === 0) return []

  const docScores: { [doc: string]: number } = {}
  queryTokens.forEach(token => {
    if (!index.docFreqsByToken[token]) {
      return
    }

    index.docFreqsByToken[token].forEach(([docId, freq]) => {
      const idf = Math.log(
        (index.numOfDocs - index.docFreqsByToken[token].length + 0.5) /
        (index.docFreqsByToken[token].length + 0.5)
      )
      const score = idf * (
        (freq * (options.bm25.k1 + 1)) /
        (freq + options.bm25.k1 * (1 - options.bm25.b + options.bm25.b * (index.docLengths[docId] / index.avgDocLength)))
      )

      docScores[docId] = (docScores[docId] || 0) + score
    })
  })

  const ranked = Object.entries(docScores).sort((a: any, b: any) => b[1] - a[1])

  return ranked.slice(size)
    .map(([docId, score]) => ({ docId: Number(docId), score }) as SearchResult)
}

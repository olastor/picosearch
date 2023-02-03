const { buildSearchIndex, querySearchIndex } = require('../lib')
const porterStemmer = require('porter-stemmer')
const { eng } = require('stopword')

sentences = [
  'A man is eating food.',
  'A man is eating a piece of bread.',
  'The girl is carrying a baby.',
  'A man is riding a horse.',
  'A woman is playing violin.',
  'Two men pushed carts through the woods.',
  'A man is riding a white horse on an enclosed ground.',
  'A monkey is playing drums.',
  'A cheetah is running behind its prey.'
]

const searchOptions = {
  stemmer: porterStemmer.stemmer,
  lowercase: true,
  stripPunctuation: true,
  stopwords: eng
}

const searchQuery = 'monkeys and bread'
console.log(`Searching for "${searchQuery}"`)

const searchIndex = buildSearchIndex(sentences, searchOptions)
const searchResults = querySearchIndex(searchQuery, searchIndex, searchOptions)

console.log(searchResults.map(({ docId, score }) => [sentences[docId], score]))

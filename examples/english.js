const { buildSearchIndex, querySearchIndex } = require('../lib')
const porterStemmer = require('porter-stemmer')
const { eng } = require('stopword')

sentences = [
  'A man is eating food.',
  'A man is buying bread.',
  'The woman is riding a bike.',
  'A woman is playing a violin.',
  'Two men are biking.',
  'Two women are biking.',
]

const searchOptions = {
  stemmer: porterStemmer.stemmer,
  lowercase: true,
  stripPunctuation: true,
  stopwords: eng
}

const searchQuery = 'who bought breads?'
console.log(`Searching for "${searchQuery}"`)

const searchIndex = buildSearchIndex(sentences, searchOptions)
const searchResults = querySearchIndex(searchQuery, searchIndex, searchOptions)

console.log(searchResults.map(({ docId, score }) => [sentences[docId], score]))

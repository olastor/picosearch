const { createIndex, indexDocument, searchIndex } = require('../dist')
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

const analyzer = {
  stemmer: porterStemmer.stemmer,
  lowercase: true,
  stripPunctuation: true,
  stopwords: eng
}


const index = createIndex({
  title: 'text',
  body: 'text',
  topic: 'keyword'
})
const docs = [
  { _id: 'doc1', title: 'Milk', body: 'A man is drinking milk.', topic: 'a' },
  { _id: 'doc2',title: 'Bread', body: 'A man is eating bread.', topic: 'a' },
   { _id: 'doc3', title: 'Butter', body: 'A man is eating bread and butter.', topic: 'b' }
]
docs.forEach((doc) => indexDocument(index, doc, analyzer))


; (async () => {
console.log(JSON.stringify(await searchIndex(index, 'breet', {
  offset: 0,
  size: 10,
  queryFields: {
    body: { highlight: true },
    title: { highlight: true }
  },
  fuzziness: {
    maxError: 2,
    prefixLength: 3
  },
  filter: {
    topic: 'a'
  },
  getDocument: (d) => docs.find(({_id}) => _id === d)
}, analyzer), null, 2))

})()

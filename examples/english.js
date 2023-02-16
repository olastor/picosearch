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
  body: 'text'
})

indexDocument(index, { _id: 'doc1', title: 'Milk', body: 'A man is drinking milk.' }, analyzer)
indexDocument(index, { _id: 'doc2',title: 'Bread', body: 'A man is eating bread.' }, analyzer)
indexDocument(index, { _id: 'doc3', title: 'Butter', body: 'A man is eating bread and butter.' }, analyzer)

console.log(index)
console.log(searchIndex('Who is eating bread?', index, {
  offset: 0,
  size: 10
}, analyzer))

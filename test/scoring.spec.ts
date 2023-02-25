import fetch from 'node-fetch'
import { 
  indexDocument,
  createIndex,
  searchIndex,
  DEFAULT_QUERY_OPTIONS
} from '../src/'
import * as fs from 'fs'
import * as path from 'path'

const porterStemmer = require('porter-stemmer')
const { eng } = require('stopword')

const REGEXP_PATTERN_PUNCT = new RegExp("['!\"“”#$%&\\'()\*+,\-\.\/:;<=>?@\[\\\]\^_`{|}~']", 'g')

const analyzer = (text: string): string[] => {
  const tokens: string[] = text.match(/\w+|\$[\d\.]+|\S+/g) || []
  return tokens
    .map(token => token.trim().replace(REGEXP_PATTERN_PUNCT, '').toLowerCase())
    .map(token => porterStemmer.stemmer(token))
    .filter(token => token && !eng.includes(token))
}

const calculateNdcg10 = (queryId: any, qrels: any, hits: any) => {
  const scores = hits.map((h: any) => qrels[queryId][h._id] ? qrels[queryId][h._id] : 0)
  const dcg10 = scores.reduce((partialSum: number, x: number, i: number) => partialSum + (x / Math.log2(i + 2)), 0)
  const idcg10 = Object.values(qrels[queryId])
    .sort((a: any, b: any) => b - a)
    .slice(0, 10)
    .reduce((partialSum: any, x: any, i: any) => partialSum + (x / Math.log2(i + 2)), 0)

  const ndcg10 = dcg10 / (idcg10 as number)
  return ndcg10
}

const evaluateDataset = async (name: string, options: any) => {
  const corpus = fs.readFileSync(path.join(__dirname, `testdata/${name}/corpus.jsonl`), 'utf-8')
    .split('\n')
    .filter(s => s)
    .map(s => JSON.parse(s))

  const queries = fs.readFileSync(path.join(__dirname, `testdata/${name}/queries.jsonl`), 'utf-8')
    .split('\n')
    .filter(s => s)
    .map(s => JSON.parse(s))

  let qrels: { [key: string]: { [key: string]: number } } = {}
  fs.readFileSync(path.join(__dirname, `testdata/${name}/qrels/test.tsv`), 'utf-8')
    .split('\n')
    .slice(1)
    .filter(s => s)
    .map(s => s.split('\t'))
    .map(([queryId, corpusId, score]) => {
      if (typeof qrels[queryId] === 'undefined') {
        qrels[queryId] = {}
      }
      qrels[queryId][corpusId] = Number(score)
    })


  const docs = corpus.map(({ text, title, _id }) => ({ title, text, _id }))

  console.time(`INDEX: ${name}`)
  const index = createIndex({ text: 'text', title: 'text' })
  docs.forEach((doc: any) => indexDocument(
    index, 
    { _id: doc._id, text: doc['text'], title: doc['title'] }, analyzer
  ))
  console.timeEnd(`INDEX: ${name}`)

  console.time(`EVAL: ${name}`)
  let ndcgSum = 0
  let count = 0

  for (const query of queries) {
    if (typeof qrels[query._id] === 'undefined') continue;
    count++
    let { hits } = await searchIndex(index, query.text, options, analyzer)
    ndcgSum += calculateNdcg10(query._id, qrels, hits)
  }
  console.timeEnd(`EVAL: ${name}`)
  const avgNdcg10 = ndcgSum / count
  return avgNdcg10
}

describe('Benchmark', () => {
  test('should exceed minimum expected benchmark scores', async () => {
    const options = {
      ...DEFAULT_QUERY_OPTIONS,
      queryFields: ['title', 'text'],
      size: 10,
      bm25: {
        b: 0.75,
        k1: 1.2
      }
    }

    // const corpora = ['scifact', 'nfcorpus', 'scidocs']
    const corpora = ['scifact', 'nfcorpus']
    const minScores: { [key: string]: number } = {
      scifact: 0.681,
      nfcorpus: 0.326,
      scidocs: 0.153
    }

    for (const corpus of corpora) {
      const avgNdcg10 = await evaluateDataset(corpus, options)
      console.log(avgNdcg10)
      expect(minScores[corpus] < avgNdcg10).toEqual(true)
    }
  })
});

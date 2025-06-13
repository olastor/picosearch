import fs from 'node:fs/promises';
import * as https from 'node:https';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import * as unzipper from 'unzipper';
import { beforeAll, describe, expect, test } from 'vitest';
import { Picosearch } from '../src/';

import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as englishOptions from '@picosearch/language-english';
import type { SearchResultWithDoc } from '../src/types';

const downloadAndExtractCorpus = async (corpusName: string): Promise<void> => {
  const pipelineAsync = promisify(pipeline);
  const dataDir = path.join(__dirname, 'data');
  const corpusJsonlPath = path.join(dataDir, corpusName, 'corpus.jsonl');
  if (fsSync.existsSync(corpusJsonlPath)) return;
  console.log(`Downloading ${corpusName}`);
  const file = fsSync.createWriteStream(`${corpusName}.zip`);
  await new Promise<void>((resolve, reject) => {
    https
      .get(
        `https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/${corpusName}.zip`,
        (response) => pipelineAsync(response, file).then(resolve).catch(reject),
      )
      .on('error', reject);
  });
  await pipelineAsync(
    fsSync.createReadStream(`${corpusName}.zip`),
    unzipper.Extract({ path: dataDir }),
  );
  await fs.unlink(`${corpusName}.zip`);
};

const calculateNdcg10 = (
  queryId: string,
  qrels: Qrels,
  hits: SearchResultWithDoc<any>[],
) => {
  const scores = hits.slice(0, 10).map((h) => qrels[queryId][h.id] ?? 0);
  const dcg10 = scores.reduce(
    (partialSum: number, x: number, i: number) =>
      partialSum + x / Math.log2(i + 2),
    0,
  );
  const idcg10 = Object.values(qrels[queryId])
    .sort((a, b) => b - a)
    .slice(0, 10)
    .reduce((partialSum, x, i) => partialSum + x / Math.log2(i + 2), 0);

  return dcg10 / idcg10;
};

type CorpusItem = {
  _id: string;
  title: string;
  text: string;
  metadata: Record<string, any>;
};
type QueryItem = { _id: string; text: string; metadata: Record<string, any> };
type Qrels = { [queryId: string]: { [corpusId: string]: number } };

const loadCorpusFile = <T extends CorpusItem | QueryItem>(
  corpus: string,
  dataType: 'corpus' | 'queries',
): T[] =>
  fsSync
    .readFileSync(
      path.join(__dirname, `data/${corpus}/${dataType}.jsonl`),
      'utf-8',
    )
    .split('\n')
    .filter((s) => s)
    .map((s) => JSON.parse(s) as T);

const loadCorpusQrels = (
  corpus: string,
  dataSet: 'dev' | 'train' | 'test',
): Qrels => {
  const qrels: Qrels = {};
  fsSync
    .readFileSync(
      path.join(__dirname, `data/${corpus}/qrels/${dataSet}.tsv`),
      'utf-8',
    )
    .split('\n')
    .slice(1)
    .filter((line) => line)
    .map((line) => line.split('\t'))
    .forEach(([queryId, corpusId, score]) => {
      qrels[queryId] ??= {};
      qrels[queryId][corpusId] = Number(score);
    });

  return qrels;
};

const evaluateDataset = async (corpusName: string): Promise<number> => {
  const corpus = loadCorpusFile<CorpusItem>(corpusName, 'corpus');
  const queries = loadCorpusFile<QueryItem>(corpusName, 'queries');
  const qrels = loadCorpusQrels(corpusName, 'test');

  const docs = corpus.map(({ text, title, _id }) => ({ title, text, id: _id }));

  const indexTag = `Indexing Time (${corpusName})`;
  console.time(indexTag);
  const index = new Picosearch({
    ...englishOptions,
    keepDocuments: false,
    enableAutocomplete: false,
  });
  index.insertMultipleDocuments(docs);
  console.timeEnd(indexTag);

  const evalTag = `Evaluation Time (${corpusName})`;
  console.time(evalTag);
  let ndcgSum = 0;
  let count = 0;

  for (const query of queries) {
    if (typeof qrels[query._id] === 'undefined') continue;
    count++;
    const hits = await index.searchDocuments(query.text, {
      bm25: { b: 0.75, k1: 1.2 },
      includeDocs: true,
    });
    ndcgSum += calculateNdcg10(query._id, qrels, hits);
  }
  console.timeEnd(evalTag);

  const avgNdcg10 = ndcgSum / count;
  console.log(`Evaluation Score (${corpusName}): ${avgNdcg10}`);
  return avgNdcg10;
};

const BENCHMARK_CORPORA = ['scifact', 'nfcorpus', 'scidocs'] as const;
const MIN_EXPECTED_NGCD10_SCORES: Record<
  (typeof BENCHMARK_CORPORA)[number],
  number
> = {
  scifact: 0.681,
  nfcorpus: 0.325,
  scidocs: 0.153,
} as const;

describe('Benchmark', () => {
  beforeAll(async () => {
    await Promise.all(BENCHMARK_CORPORA.map(downloadAndExtractCorpus));
  });

  for (const corpus of BENCHMARK_CORPORA) {
    test(`should exceed minimum expected benchmark score for ${corpus}`, async () => {
      const avgNdcg10 = await evaluateDataset(corpus);
      expect(avgNdcg10).toBeGreaterThanOrEqual(
        MIN_EXPECTED_NGCD10_SCORES[corpus],
      );
    });
  }
});

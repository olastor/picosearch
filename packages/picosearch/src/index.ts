import { scoreBM25F } from './bm25f';
import { DEFAULT_QUERY_OPTIONS } from './constants';
import type {
  Analyzer,
  IPicosearch,
  PicosearchDocument,
  PicosearchOptions,
  QueryOptions,
  SearchIndex,
  SearchResult,
  SerializedInstance,
  Tokenizer,
} from './interfaces';
import { Trie } from './trie';
import { parseFieldNameAndWeight } from './util';

export const defaultTokenizer: Tokenizer = (doc: string): string[] =>
  doc.match(/\w+/g) || [];

export const defaultAnalyzer: Analyzer = (token: string): string => token;

export type {
  Analyzer,
  PicosearchDocument,
  PicosearchOptions,
  QueryOptions,
  SearchIndex,
  SearchResult,
  SerializedInstance,
  Tokenizer,
};

export class Picosearch<T extends PicosearchDocument>
  implements IPicosearch<T>
{
  private tokenizer: Tokenizer = defaultTokenizer;
  private analyzer: Analyzer = defaultAnalyzer;
  private keepDocuments = true;

  private searchIndex: SearchIndex<T>;

  constructor(
    { tokenizer, analyzer, keepDocuments, jsonIndex }: PicosearchOptions = {
      tokenizer: defaultTokenizer,
      analyzer: defaultAnalyzer,
      keepDocuments: true,
    },
  ) {
    if (tokenizer) this.tokenizer = tokenizer;
    if (analyzer) this.analyzer = analyzer;
    if (jsonIndex) {
      const { opts, index } = JSON.parse(jsonIndex) as SerializedInstance<T>;
      this.keepDocuments = opts.keepDocuments ?? true;
      this.searchIndex = index;
      return;
    }
    if (typeof keepDocuments === 'boolean') this.keepDocuments = keepDocuments;
    this.searchIndex = {
      originalDocumentIds: [],
      fields: [],
      docFreqsByToken: new Trie<[number, number, number]>(),
      docLengths: {},
      totalDocLengthsByFieldId: {},
      docCountsByFieldId: {},
      docCount: 0,
      docsById: {},
    };
  }

  private preprocess(doc: string): string[] {
    return this.tokenizer(doc)
      .map(this.analyzer)
      .filter((t) => t);
  }

  insertDocument(document: T) {
    if (typeof document.id !== 'string' || document.id === '') {
      throw new Error(
        `The document's required 'id' field is missing or not a string. Got: ${document.id}`,
      );
    }

    if (this.searchIndex.originalDocumentIds.includes(document.id)) {
      throw new Error(`Duplicate document ID: ${document.id}`);
    }

    const internalDocId = this.searchIndex.originalDocumentIds.length;
    this.searchIndex.originalDocumentIds.push(document.id);

    for (const field of Object.keys(document)) {
      if (field === 'id') continue;
      let fieldId = this.searchIndex.fields.findIndex((f) => f === field);
      if (fieldId < 0) {
        fieldId = this.searchIndex.fields.length;
        this.searchIndex.fields.push(field);
      }

      const fieldTokens = this.preprocess(document[field]);

      this.searchIndex.docLengths[internalDocId] ??= {};
      this.searchIndex.totalDocLengthsByFieldId[fieldId] ??= 0;
      this.searchIndex.docCountsByFieldId[fieldId] ??= 0;

      this.searchIndex.docLengths[internalDocId][fieldId] = fieldTokens.length;
      this.searchIndex.totalDocLengthsByFieldId[fieldId] += fieldTokens.length;
      this.searchIndex.docCountsByFieldId[fieldId]++;

      const fieldTokenFreqs = fieldTokens.reduce(
        (acc: { [token: string]: number }, token: string) => {
          acc[token] = (acc[token] || 0) + 1;
          return acc;
        },
        {},
      );

      for (const [token, frequency] of Object.entries(fieldTokenFreqs)) {
        // TODO: there might be better strategies to create a sequence for the trie insert than just
        //       splitting the token into single characters.
        const sequence = token.split('');
        this.searchIndex.docFreqsByToken.insert(sequence, [
          [internalDocId, fieldId, frequency],
        ]);
      }
    }

    if (this.keepDocuments) {
      this.searchIndex.docsById[internalDocId] = document;
    }

    this.searchIndex.docCount++;
  }

  insertMultipleDocuments(documents: T[]) {
    for (const document of documents) {
      this.insertDocument(document);
    }
  }

  searchDocuments(
    query: string,
    options: QueryOptions = DEFAULT_QUERY_OPTIONS,
  ): SearchResult<T>[] {
    const tokens = [...new Set(this.preprocess(query))];

    const defaultWeight = options.fields?.length ? 0 : 1;
    const fieldWeights = Object.fromEntries(
      this.searchIndex.fields.map((_, i) => [i, defaultWeight]),
    );
    if (options.fields?.length) {
      for (const [fieldName, weight] of options.fields.map(
        parseFieldNameAndWeight,
      )) {
        const fieldId = this.searchIndex.fields.indexOf(fieldName);
        if (fieldId === -1) throw new Error(`Unknown field '${fieldName}'!`);
        fieldWeights[fieldId] = weight;
      }
    }

    const k1 = options?.bm25?.k1 ?? DEFAULT_QUERY_OPTIONS.bm25.k1;
    const b = options?.bm25?.b ?? DEFAULT_QUERY_OPTIONS.bm25.b;

    return scoreBM25F<T>(tokens, this.searchIndex, fieldWeights, k1, b).slice(
      options.offset ?? 0,
      options?.limit,
    );
  }

  toJSON(): string {
    const jsonObj: SerializedInstance<T> = {
      index: this.searchIndex,
      opts: {
        keepDocuments: this.keepDocuments,
      },
    };

    return JSON.stringify(jsonObj);
  }
}

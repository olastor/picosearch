export interface SearchOptions {
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

export interface TextIndex {
  numOfDocs: number;
  docFreqsByToken: { [key: string]: [number, number][] };
  docLengths: { [key: string]: number };
  avgDocLength: number;
}

export interface SearchResult {
  docId: number;
  score: number;
}

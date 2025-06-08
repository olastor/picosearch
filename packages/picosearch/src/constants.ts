export const DEFAULT_QUERY_OPTIONS = {
  bm25: {
    k1: 1.2,
    b: 0.75,
  },
  maxExpansions: 5,
} as const;

export const DEFAULT_AUTOCOMPLETE_OPTIONS = {
  method: 'prefix',
  fuzziness: 'AUTO',
  limit: 10,
} as const;

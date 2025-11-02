import type { ParsedOptions, SearchIndex } from './schemas';
import type { Document, Patch, PatchChange, TokenInfo } from './types';
import { assert, flatten } from './util';

export const createPatch =
  <T extends Document>(opts: ParsedOptions<T>, searchIndex: SearchIndex<T>) =>
  ({ add }: { add: T[] }): Patch<T> => {
    const change: PatchChange<T> = {
      type: 'add',
      addedFields: [],
      addedOriginalDocumentIds: [],
      addedTermTreeLeaves: Object.create(null),
      addedDocLengths: Object.create(null),
      addedTotalDocLengthsByFieldId: {},
      addedDocCountsByFieldId: {},
      addedDocCount: add.length,
    };

    for (let i = 0; i < add.length; i++) {
      const document = add[i];
      const flattenedDoc = flatten(document);

      const idValue = flattenedDoc[opts.idField];
      if (typeof idValue !== 'string' || !idValue) {
        throw new Error(
          `The document's required '${opts.idField}' field is missing or not a string. Got: ${idValue}`,
        );
      }

      if (searchIndex.originalDocumentIds.includes(idValue)) {
        throw new Error(`Duplicate document ID: ${idValue}`);
      }

      const internalDocId = searchIndex.originalDocumentIds.length + i;
      change.addedOriginalDocumentIds.push(idValue);

      for (const [field, value] of Object.entries(flattenedDoc)) {
        if (
          field === opts.idField ||
          typeof value !== 'string' ||
          (opts.indexedFields && !opts.indexedFields?.includes(field))
        ) {
          continue;
        }

        let fieldId = [...searchIndex.fields, ...change.addedFields].findIndex(
          (f) => f === field,
        );
        if (fieldId < 0) {
          fieldId = searchIndex.fields.length + change.addedFields.length;
          change.addedFields.push(field);
        }

        const fieldTokens: string[] = [];

        // the unprocessed tokens are only for fuzyy search / autocomplete,
        // so their frequency doesn't matter and we use a set
        const fieldTokensRaw: Set<string> = new Set<string>();

        opts.tokenizer(value).forEach((rawToken) => {
          const token = opts.analyzer(rawToken);
          if (!token) return;
          fieldTokens.push(token);
          if (opts.enableAutocomplete) fieldTokensRaw.add(rawToken);
        });

        change.addedDocLengths[internalDocId] ??= {};
        change.addedTotalDocLengthsByFieldId[fieldId] ??= 0;
        change.addedDocCountsByFieldId[fieldId] ??= 0;

        change.addedDocLengths[internalDocId][fieldId] = fieldTokens.length;
        change.addedTotalDocLengthsByFieldId[fieldId] += fieldTokens.length;
        change.addedDocCountsByFieldId[fieldId]++;

        const fieldTokenFreqs = fieldTokens.reduce(
          (acc: { [token: string]: number }, token: string) => {
            acc[token] = (acc[token] || 0) + 1;
            return acc;
          },
          {},
        );

        for (const rawToken of fieldTokensRaw) {
          // raw tokens are indexed only for fuzzy search / autocomplete
          // make sure they are marked with 1
          const rawTokenLower = rawToken.toLowerCase();
          change.addedTermTreeLeaves[rawTokenLower] ??= [];
          if (change.addedTermTreeLeaves[rawTokenLower][0] !== 1) {
            change.addedTermTreeLeaves[rawTokenLower].unshift(1);
          }
        }

        for (const [token, frequency] of Object.entries(fieldTokenFreqs)) {
          const tokenInfo: TokenInfo = [internalDocId, fieldId, frequency];
          change.addedTermTreeLeaves[token] ??= [];
          change.addedTermTreeLeaves[token].push(tokenInfo);
        }
      }

      if (opts.keepDocuments) {
        change.addedDocsById ??= {};
        change.addedDocsById[internalDocId] = document;
      }
    }

    return {
      indexId: searchIndex.id,
      version: searchIndex.version + 1,
      changes: [change],
    };
  };

export const applyPatch =
  <T extends Document>(searchIndex: SearchIndex<T>, updateVersion = true) =>
  (patch: Patch<T>): void => {
    assert(
      searchIndex.id === patch.indexId,
      `Expected patch to have index ID ${searchIndex.id}, got: ${patch.indexId}`,
    );

    assert(
      searchIndex.version === patch.version - 1,
      `Expected patch to have version ${searchIndex.version + 1}, got: ${patch.version}`,
    );

    if (updateVersion) {
      searchIndex.version = patch.version;
    }
    for (const change of patch.changes) {
      assert(change.type === 'add', 'change type must be add');

      searchIndex.fields.push(...change.addedFields);
      searchIndex.originalDocumentIds.push(...change.addedOriginalDocumentIds);
      for (const [token, values] of Object.entries(
        change.addedTermTreeLeaves,
      )) {
        if (values[0] === 1) {
          searchIndex.termTree.insert(token);
          const node = searchIndex.termTree.lookup(token, true);
          assert(!!node, 'node is undefined');
          node.v ??= [];
          if (node.v[0] !== 1) node.v.unshift(1);
          const tokenInfos = values.slice(1);
          searchIndex.termTree.insertNoFuzzy(token, ...tokenInfos);
        } else {
          searchIndex.termTree.insertNoFuzzy(token, ...values);
        }
      }
      searchIndex.docLengths = {
        ...searchIndex.docLengths,
        ...change.addedDocLengths,
      };
      for (const [fieldId, addedLength] of Object.entries(
        change.addedTotalDocLengthsByFieldId,
      )) {
        searchIndex.totalDocLengthsByFieldId[Number(fieldId)] =
          (searchIndex.totalDocLengthsByFieldId[Number(fieldId)] ?? 0) +
          addedLength;
      }
      for (const [fieldId, addedCount] of Object.entries(
        change.addedDocCountsByFieldId,
      )) {
        searchIndex.docCountsByFieldId[Number(fieldId)] =
          (searchIndex.docCountsByFieldId[Number(fieldId)] ?? 0) + addedCount;
      }
      searchIndex.docCount += patch.changes[0].addedDocCount;
      searchIndex.docsById = {
        ...searchIndex.docsById,
        ...change.addedDocsById,
      };
    }
  };

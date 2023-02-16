



// export const checkSearchOptions = (options: SearchOptions): SearchOptions => {
//   const optionsValid = {
//     ...DEFAULT_SEARCH_OPTIONS,
//     ...options
//   } 

//   return optionsValid
// }




// export const getDocumentIdsForFilter = (
//   index: SearchIndex, 
//   filter: { [field: string]: any }
// ): null | number[] => {
//   let filteredDocumentIds: null | number[] = null

//   const applyKeywordFilter = (field: string, value: string) => {
//     if (filteredDocumentIds === null) {
//       filteredDocumentIds = (index.fields[field] as KeywordFieldIndex)[value]
//     } else {
//       const docIdsNew = (index.fields[field] as KeywordFieldIndex)[value]
//       filteredDocumentIds = filteredDocumentIds.filter(docId => docIdsNew.includes(docId))
//     }
//   }

//   for (const [field, filterValue] of Object.entries(filter)) {
//     if (typeof index.mapping[field] === 'undefined') {
//       throw new Error(`Cannot filter for field '${field}' because it does not exist in mapping.`);
//     }

//     if (index.mapping[field] === 'keyword') {
//       if (Array.isArray(filterValue)) {
//         filterValue.map(value => applyKeywordFilter(field, value)) 
//       } else {
//         applyKeywordFilter(field, filterValue)
//       }
//     }
//   }

//   return filteredDocumentIds
// }



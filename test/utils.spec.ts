import { 
  findRemovedPartsByTokenizer,
  reconstructTokenizedDoc
} from '../src/utils'

describe('Utils', () => {
  describe('Doc Reconstruction', () => {
    test('reconstructing doc from tokenized version should work', () => {
      const tokenizer = (s: string) => s.split(/\s+/g)
      const doc = 'A  house   is red and  blue.       '
      const tokens = tokenizer(doc)
      expect(reconstructTokenizedDoc(tokens, findRemovedPartsByTokenizer(doc, tokens))).toBe(doc)
    })
  })
})


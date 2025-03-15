import { Picosearch } from '@picosearch/picosearch';
import * as englishOptions from '@picosearch/language-english';

type Doc = {
  id: string;
  text: string;
  additionalText: string;
};

export const TEST_DOCS: Doc[] = [
  { id: '1', text: 'The quick brown fox', additionalText: 'A speedy canine' },
  { id: '2', text: 'Jumps over the lazy dog', additionalText: 'High leap' },
  { id: '3', text: 'Bright blue sky', additionalText: 'Clear and sunny day' },
  { id: '4', text: 'The number one choice', additionalText: 'Top selection' },
  {
    id: '5',
    text: 'Tips and tricks for coding',
    additionalText: 'Helpful advice',
  },
];

const pico = new Picosearch<Doc>({ ...englishOptions });
pico.insertMultipleDocuments(TEST_DOCS);
console.log(pico.searchDocuments('quick jump'));

# German Text Preprocessor

This module provides basic text preprocessing functions for German text, including tokenization, punctuation removal, stopword filtering, and stemming.

## Functions

### tokenizer(doc: string): string[]

This function takes a string as input and returns an array of tokens (words) extracted from by matching it against word characters. If the input is not a string, it returns an empty array.

### analyzer(token: string): string

This function processes a single token by removing punctuation and converting it to lowercase. It then checks the token against a list of German stopwords and removes it if found. If not, it stems the token using the `stem` function from `./cistem`.

## Dependencies

- `cistem`: A module for stemming German words.
- `stopword`: A library containing a list of stopwords for various languages, including German.

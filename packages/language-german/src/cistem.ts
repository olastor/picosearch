// MIT License
//
// Copyright (c) 2017 Leonie Weißweiler
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// Note not by the author:
//   - The code was adjusted for Typescripts and improved code style
//     while preserving the orginial functions.
//   - The segment function was removed because it's not used

/**
 * CISTEM Stemmer for German
 *
 * This is the official Javascript implementation of the CISTEM stemmer.
 * It is based on the paper
 * Leonie Weißweiler, Alexander Fraser (2017). Developing a Stemmer for German Based on a Comparative Analysis of Publicly Available Stemmers. In Proceedings of the German Society for Computational Linguistics and Language Technology (GSCL)
 * which can be read here:
 * http://www.cis.lmu.de/~weissweiler/cistem/
 *
 * In the paper, we conducted an analysis of publicly available stemmers, developed
 * two gold standards for German stemming and evaluated the stemmers based on the
 * two gold standards. We then proposed the stemmer implemented here and show
 * that it achieves slightly better f-measure than the other stemmers and is
 * thrice as fast as the Snowball stemmer for German while being about as fast as
 * most other stemmers.
 */

const stripge = /^ge(.{4,})/;
const replxx = /(.)\1/g;
const replxxback = /(.)\*/g;
const replü = /ü/g;
const replö = /ö/g;
const replä = /ä/g;
const replß = /ß/g;
const replsch = /sch/g;
const replei = /ei/g;
const replie = /ie/g;
const replschback = /\$/g;
const repleiback = /%/g;
const replieback = /&/g;
const stripemr = /e[mr]$/;
const stripnd = /nd$/;
const stript = /t$/;
const stripesn = /[esn]$/;

/**
 * This method takes the word to be stemmed and a boolean specifiying if case-insensitive stemming should be used and returns the stemmed word. If only the word
 * is passed to the method or the second parameter is 0, normal case-sensitive stemming is used, if the second parameter is 1, case-insensitive stemming is used.
 * Case sensitivity improves performance only if words in the text may be incorrectly upper case.
 * For all-lowercase and correctly cased text, best performance is achieved by
 * using the case-sensitive version.
 * @param {String} word
 * @param {boolean} case_insensitive
 * @returns {String}
 */
export const stem = (word: string, case_insensitive = false): string => {
  if (word.length === 0) return word;

  const upper = word[0] === word[0].toUpperCase();
  let wordNew = word
    .toLowerCase()
    .replace(replü, 'u')
    .replace(replö, 'o')
    .replace(replä, 'a')
    .replace(replß, 'ss')
    .replace(stripge, '$1')
    .replace(replsch, '$')
    .replace(replei, '%')
    .replace(replie, '&')
    .replace(replxx, '$1*');

  while (wordNew.length > 3) {
    let result: string;

    if (wordNew.length > 5) {
      result = wordNew.replace(stripemr, '');
      if (result !== wordNew) {
        wordNew = result;
        continue;
      }

      result = wordNew.replace(stripnd, '');
      if (result !== wordNew) {
        wordNew = result;
        continue;
      }
    }

    if (!upper || case_insensitive) {
      result = wordNew.replace(stript, '');
      if (result !== wordNew) {
        wordNew = result;
        continue;
      }
    }

    result = wordNew.replace(stripesn, '');
    if (result !== wordNew) {
      wordNew = result;
    } else {
      break;
    }
  }

  return wordNew
    .replace(replxxback, '$1$1')
    .replace(repleiback, 'ei')
    .replace(replieback, 'ie')
    .replace(replschback, 'sch');
};

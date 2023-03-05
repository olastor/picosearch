import { snippet } from '../src/utils/snippet'

describe('snippet', () => {
  it('should return empty array if no highlights', () => {
    expect(
      snippet(
        'This is a test with a text.',
        '<b>',
        '</b>',
        4
      )
    ).toEqual([])
  })

  it('should create correct snippets', () => {
    expect(
      snippet(
        'This is a <b>test</b> with a text.',
        '<b>',
        '</b>',
        4
      )
    ).toEqual(['is a <b>test</b> with'])

    expect(
      snippet(
        'This is <b>a</b> test with <b>a</b> text.',
        '<b>',
        '</b>',
        4
      )
    ).toEqual(['This is <b>a</b> test', 'with <b>a</b> text.'])
  })

  it('should merge overlapping snippets', () => {
    expect(
      snippet(
        'This is <b>a</b> test with <b>a</b> text.',
        '<b>',
        '</b>',
        5
      )
    ).toEqual(['This is <b>a</b> test with <b>a</b> text.'])
  })
})

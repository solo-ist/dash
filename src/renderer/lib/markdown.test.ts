import { describe, it, expect } from 'vitest'
import { parseInline, parseBlocks } from './markdown'

describe('parseInline', () => {
  it('returns an empty array for an empty string', () => {
    expect(parseInline('')).toEqual([])
  })

  it('parses plain text with no markers', () => {
    expect(parseInline('hello world')).toEqual([{ kind: 'text', text: 'hello world' }])
  })

  it('parses bold text', () => {
    expect(parseInline('**bold**')).toEqual([{ kind: 'bold', text: 'bold' }])
  })

  it('parses italic text', () => {
    expect(parseInline('*italic*')).toEqual([{ kind: 'italic', text: 'italic' }])
  })

  it('parses inline code', () => {
    expect(parseInline('`code`')).toEqual([{ kind: 'code', text: 'code' }])
  })

  it('parses a link', () => {
    expect(parseInline('[text](https://example.com)')).toEqual([
      { kind: 'link', text: 'text', href: 'https://example.com' }
    ])
  })

  it('parses surrounding plain text around a single construct', () => {
    expect(parseInline('before **bold** after')).toEqual([
      { kind: 'text', text: 'before ' },
      { kind: 'bold', text: 'bold' },
      { kind: 'text', text: ' after' }
    ])
  })

  it('parses multiple distinct constructs in sequence', () => {
    expect(parseInline('*a* `b` [c](d)')).toEqual([
      { kind: 'italic', text: 'a' },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'link', text: 'c', href: 'd' }
    ])
  })

  it('falls back to plain text for an unmatched bold/italic marker', () => {
    expect(parseInline('a * b')).toEqual([{ kind: 'text', text: 'a * b' }])
  })

  it('falls back to plain text for an unmatched code backtick', () => {
    expect(parseInline('a `b')).toEqual([{ kind: 'text', text: 'a `b' }])
  })

  it('falls back to plain text for an unmatched link bracket', () => {
    expect(parseInline('a [b] c')).toEqual([{ kind: 'text', text: 'a [b] c' }])
  })

  it('falls back to plain text when a bracket is not followed by a paren', () => {
    expect(parseInline('a [b](c d')).toEqual([{ kind: 'text', text: 'a [b](c d' }])
  })

  it('never throws on arbitrary marker soup', () => {
    expect(() => parseInline('**`*[](')).not.toThrow()
  })
})

describe('parseBlocks', () => {
  it('returns an empty array for an empty string', () => {
    expect(parseBlocks('')).toEqual([])
  })

  it('parses a level 1 heading', () => {
    expect(parseBlocks('# Title')).toEqual([
      { kind: 'heading', level: 1, inline: [{ kind: 'text', text: 'Title' }] }
    ])
  })

  it('parses a level 2 heading', () => {
    expect(parseBlocks('## Subtitle')).toEqual([
      { kind: 'heading', level: 2, inline: [{ kind: 'text', text: 'Subtitle' }] }
    ])
  })

  it('parses a level 3 heading', () => {
    expect(parseBlocks('### Small')).toEqual([
      { kind: 'heading', level: 3, inline: [{ kind: 'text', text: 'Small' }] }
    ])
  })

  it('parses a single paragraph', () => {
    expect(parseBlocks('hello world')).toEqual([
      { kind: 'paragraph', inline: [{ kind: 'text', text: 'hello world' }] }
    ])
  })

  it('joins wrapped lines within a single paragraph', () => {
    expect(parseBlocks('line one\nline two')).toEqual([
      { kind: 'paragraph', inline: [{ kind: 'text', text: 'line one line two' }] }
    ])
  })

  it('splits multiple paragraphs on a blank line', () => {
    expect(parseBlocks('first\n\nsecond')).toEqual([
      { kind: 'paragraph', inline: [{ kind: 'text', text: 'first' }] },
      { kind: 'paragraph', inline: [{ kind: 'text', text: 'second' }] }
    ])
  })

  it('parses a list with several items', () => {
    expect(parseBlocks('- one\n- two\n- three')).toEqual([
      {
        kind: 'list',
        items: [
          [{ kind: 'text', text: 'one' }],
          [{ kind: 'text', text: 'two' }],
          [{ kind: 'text', text: 'three' }]
        ]
      }
    ])
  })

  it('parses a heading followed by a paragraph and a list', () => {
    expect(parseBlocks('# Title\nintro text\n- item a\n- item b')).toEqual([
      { kind: 'heading', level: 1, inline: [{ kind: 'text', text: 'Title' }] },
      { kind: 'paragraph', inline: [{ kind: 'text', text: 'intro text' }] },
      {
        kind: 'list',
        items: [
          [{ kind: 'text', text: 'item a' }],
          [{ kind: 'text', text: 'item b' }]
        ]
      }
    ])
  })

  it('parses inline formatting within a paragraph', () => {
    expect(parseBlocks('a **bold** word')).toEqual([
      {
        kind: 'paragraph',
        inline: [
          { kind: 'text', text: 'a ' },
          { kind: 'bold', text: 'bold' },
          { kind: 'text', text: ' word' }
        ]
      }
    ])
  })

  it('never throws on arbitrary input', () => {
    expect(() => parseBlocks('# \n- \n\n\n**')).not.toThrow()
  })
})

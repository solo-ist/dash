export type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string }

export type BlockToken =
  | { kind: 'heading'; level: 1 | 2 | 3; inline: InlineToken[] }
  | { kind: 'paragraph'; inline: InlineToken[] }
  | { kind: 'list'; items: InlineToken[][] }

const HEADING_RE = /^(#{1,3})\s+(.*)$/

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let buffer = ''
  let i = 0

  function flush(): void {
    if (buffer.length > 0) {
      tokens.push({ kind: 'text', text: buffer })
      buffer = ''
    }
  }

  while (i < text.length) {
    const ch = text[i]

    if (ch === '`') {
      const close = text.indexOf('`', i + 1)
      if (close !== -1) {
        flush()
        tokens.push({ kind: 'code', text: text.slice(i + 1, close) })
        i = close + 1
        continue
      }
    } else if (ch === '*' && text[i + 1] === '*') {
      const close = text.indexOf('**', i + 2)
      if (close !== -1) {
        flush()
        tokens.push({ kind: 'bold', text: text.slice(i + 2, close) })
        i = close + 2
        continue
      }
    } else if (ch === '*') {
      const close = text.indexOf('*', i + 1)
      if (close !== -1) {
        flush()
        tokens.push({ kind: 'italic', text: text.slice(i + 1, close) })
        i = close + 1
        continue
      }
    } else if (ch === '[') {
      const closeBracket = text.indexOf(']', i + 1)
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2)
        if (closeParen !== -1) {
          flush()
          tokens.push({
            kind: 'link',
            text: text.slice(i + 1, closeBracket),
            href: text.slice(closeBracket + 2, closeParen)
          })
          i = closeParen + 1
          continue
        }
      }
    }

    buffer += ch
    i += 1
  }

  flush()
  return tokens
}

export function parseBlocks(markdown: string): BlockToken[] {
  const lines = markdown.split('\n')
  const blocks: BlockToken[] = []
  let paragraphLines: string[] = []
  let i = 0

  function flushParagraph(): void {
    if (paragraphLines.length > 0) {
      blocks.push({ kind: 'paragraph', inline: parseInline(paragraphLines.join(' ')) })
      paragraphLines = []
    }
  }

  while (i < lines.length) {
    const line = lines[i]
    const headingMatch = HEADING_RE.exec(line)

    if (headingMatch) {
      flushParagraph()
      const level = headingMatch[1].length as 1 | 2 | 3
      blocks.push({ kind: 'heading', level, inline: parseInline(headingMatch[2]) })
      i += 1
      continue
    }

    if (line.startsWith('- ')) {
      flushParagraph()
      const items: InlineToken[][] = []
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(parseInline(lines[i].slice(2)))
        i += 1
      }
      blocks.push({ kind: 'list', items })
      continue
    }

    if (line.trim().length === 0) {
      flushParagraph()
      i += 1
      continue
    }

    paragraphLines.push(line)
    i += 1
  }

  flushParagraph()
  return blocks
}

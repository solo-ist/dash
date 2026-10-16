import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TaskTitle } from './TaskTitle'

describe('TaskTitle', () => {
  it('renders bold markdown as <strong>', () => {
    const html = renderToStaticMarkup(<TaskTitle text="**bold** plain" />)
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain(' plain')
  })

  it('renders italic and inline code tokens', () => {
    const html = renderToStaticMarkup(<TaskTitle text="*it* and `cmd`" />)
    expect(html).toContain('<em>it</em>')
    expect(html).toContain('>cmd</code>')
  })

  it('renders link text without an anchor element', () => {
    const html = renderToStaticMarkup(<TaskTitle text="[x](https://e.com)" />)
    expect(html).not.toContain('<a')
    expect(html).toContain('x')
  })
})
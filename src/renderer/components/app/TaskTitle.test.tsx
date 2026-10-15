import { render } from '@testing-library/react'
import { TaskTitle } from './TaskTitle'

describe('TaskTitle', () => {
  it('renders bold text correctly', () => {
    const { container } = render(<TaskTitle text="**bold** plain" />)
    const boldElement = container.querySelector('strong')
    expect(boldElement).toBeInTheDocument()
    expect(boldElement).toHaveTextContent('bold')
    expect(container).toHaveTextContent(' plain')
  })

  it('renders link text without anchor', () => {
    const { container } = render(<TaskTitle text="[x](https://e.com)" />)
    const anchorElement = container.querySelector('a')
    expect(anchorElement).not.toBeInTheDocument()
    
    const spanElements = container.querySelectorAll('span')
    // Should have at least one span for the link text
    expect(spanElements.length).toBeGreaterThan(0)
    expect(container).toHaveTextContent('x')
  })
})
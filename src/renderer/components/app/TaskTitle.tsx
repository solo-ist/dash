import { cn } from '../../lib/utils'
import { parseInline, type InlineToken } from '../../lib/markdown'

interface TaskTitleProps {
  text: string
  className?: string
}

export function TaskTitle({ text, className }: TaskTitleProps): React.JSX.Element {
  const tokens = parseInline(text)
  
  return (
    <span className={className}>
      {tokens.map((token, index) => {
        switch (token.kind) {
          case 'bold':
            return <strong key={index}>{token.text}</strong>
          case 'italic':
            return <em key={index}>{token.text}</em>
          case 'code':
            return (
              <code
                key={index}
                className={cn(
                  'rounded-sm bg-muted px-1 py-0.5 text-xs'
                )}
              >
                {token.text}
              </code>
            )
          case 'link':
            // Render just the link text as a plain span, no anchor
            return <span key={index}>{token.text}</span>
          case 'text':
            return <span key={index}>{token.text}</span>
          default:
            return <span key={index}>{token.text}</span>
        }
      })}
    </span>
  )
}
import { Button } from './components/ui/button'

export default function App(): React.JSX.Element {
  return (
    <div className="flex h-screen flex-col">
      <header className="app-region-drag flex h-12 shrink-0 items-center justify-center border-b">
        <span className="text-sm text-muted-foreground">
          dash<span style={{ color: 'var(--brand-accent)' }}>—</span>
        </span>
      </header>
      <main className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-muted-foreground">Walking skeleton. Nothing to do yet.</p>
          <Button variant="secondary" size="sm">
            shadcn is alive
          </Button>
        </div>
      </main>
    </div>
  )
}

'use client';

/** Root-level error boundary — only used when the root layout itself
 *  throws. Renders its own <html>/<body> because the layout is gone. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'Georgia, Newsreader, serif',
          background: '#FAF7F2',
          color: '#1A1814',
          margin: 0,
          padding: '6rem 1.5rem',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <p
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#7A756C',
            }}
          >
            Derby/1M
          </p>
          <h1 style={{ fontStyle: 'italic', fontSize: 48, margin: '1rem 0 1.5rem' }}>
            Site failed to boot.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: '#2A2620' }}>
            Something went wrong at the root of the app. The specific error
            has been logged. If it persists, try a hard refresh (⌘⇧R).
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              background: '#8B1A2B',
              color: '#FAF7F2',
              border: 'none',
              padding: '0.7rem 1rem',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              cursor: 'pointer',
              borderRadius: 2,
            }}
          >
            Try again
          </button>
          <p
            style={{
              marginTop: 32,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              color: '#7A756C',
            }}
          >
            digest {error.digest ?? '—'}
          </p>
        </div>
      </body>
    </html>
  );
}

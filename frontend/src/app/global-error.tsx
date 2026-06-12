'use client';

// Global error boundary — catches errors in the root layout itself.
// It replaces the root <html>/<body>, so global CSS may not be applied.
// Styling is therefore inline and self-contained.
export default function GlobalError({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          color: '#fafafa',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: '#a1a1a1', margin: '0 0 20px' }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              cursor: 'pointer',
              borderRadius: 6,
              border: 'none',
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              backgroundColor: '#f10004',
              color: '#ffffff',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

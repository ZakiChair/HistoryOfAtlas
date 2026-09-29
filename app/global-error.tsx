'use client';

/**
 * Replaces the whole document when the root layout itself fails, so the application stylesheet
 * and the theme attribute never reach it. Everything it needs is inline, and it states one
 * palette rather than following the operating system into an unstyled contrast.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en" dir="ltr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          background: '#071b29',
          color: '#eee9dc',
          colorScheme: 'dark',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <main style={{ maxWidth: '460px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '1.5px', margin: '0 0 18px' }}>
            HISTORYOFATLAS
          </p>
          <h1 style={{ font: '400 34px/1.15 Georgia, serif', margin: '0 0 14px' }}>
            The atlas could not start.
          </h1>
          <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#a6b4b7', margin: '0 0 24px' }}>
            Trying again reloads the application. Your view is preserved in the page address.
            {error.digest ? ` Reference: ${error.digest}.` : ''}
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              border: '1px solid #d4b880',
              borderRadius: '4px',
              background: '#d4b880',
              color: '#071b29',
              padding: '11px 16px',
              font: '600 12px/1.5 system-ui, sans-serif',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

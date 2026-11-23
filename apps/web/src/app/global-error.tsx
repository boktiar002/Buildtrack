'use client';

/** Last-resort screen if the whole app fails to load. Uses no shared components on purpose. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 32, background: '#f3eee2', color: '#1f2b33' }}>
        <h1>BuildTrack could not load</h1>
        <p>Please check your internet connection and try again.</p>
        <button onClick={reset} style={{ padding: '10px 16px', borderRadius: 6, border: 0, background: '#1f2a37', color: 'white' }}>
          Try again
        </button>
      </body>
    </html>
  );
}

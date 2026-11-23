'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui';

/** Shown if a page crashes while rendering. The rest of the app keeps working. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-semibold">This page stopped working</h1>
      <p className="mt-2 text-rebar">Your data is safe. Reload the page to try again. If it keeps happening, tell the BuildTrack team{error.digest ? ` and mention reference ${error.digest}` : ''}.</p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>Reload this page</Button>
        <Button variant="secondary" onClick={() => (location.href = '/')}>Go to the home page</Button>
      </div>
    </div>
  );
}

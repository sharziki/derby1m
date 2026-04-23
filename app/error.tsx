'use client';

import { useEffect } from 'react';

/** Route-level error boundary. Catches any uncaught render error in a page
 *  and shows a calm fallback rather than a white screen. Next.js injects
 *  this automatically when a server or client component throws. */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app error]', error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-5 px-5 py-24 md:px-8">
      <span className="eyebrow">Something broke</span>
      <h1 className="font-display text-[36px] italic leading-tight text-ink-900 md:text-[48px]">
        Simulation unavailable.
      </h1>
      <p className="text-[16px] leading-relaxed text-ink-700">
        Please refresh the page. If the issue persists, the API may be warming
        up — try again in a few seconds.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-sm bg-rose-deep px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-paper-50 transition hover:bg-rose-mid"
        >
          Try again
        </button>
        <a
          href="/"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-paper-200 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-700 transition hover:border-ink-500 hover:text-ink-900"
        >
          Home
        </a>
      </div>
    </div>
  );
}

'use client';

import { cn } from '@/lib/utils';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://derby1m.vercel.app';

/** "Share on X" button. Opens twitter.com/intent/tweet with a pre-filled
 *  tweet referencing the current top horse. No tracking or auth required
 *  on our side — X handles the compose screen. */
export function ShareTwitter({
  topHorse,
  topProbability,
}: {
  topHorse: string | null;
  topProbability: number | null;
}) {
  const disabled = !topHorse || topProbability === null;
  const text = topHorse && topProbability !== null
    ? `Monte Carlo probabilities for the 2026 Kentucky Derby: ${topHorse} at ${(topProbability * 100).toFixed(1)}%. See all 20 horses →`
    : `Monte Carlo probabilities for the 2026 Kentucky Derby. One million simulated races, live →`;
  const href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SITE_URL)}`;

  return (
    <a
      href={disabled ? undefined : href}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={disabled}
      className={cn(
        'inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-paper-200 px-4 py-2.5',
        'font-mono text-[11px] uppercase tracking-[0.14em] text-ink-700',
        'transition hover:border-ink-500 hover:text-ink-900',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden fill="currentColor">
        <path d="M12.6 1.6h2.3l-5 5.7 5.9 7.8h-4.6l-3.6-4.7-4.1 4.7H1.2l5.4-6.1L0.9 1.6h4.7l3.3 4.3zm-0.8 12h1.3L4.3 3H2.9z" />
      </svg>
      Share on X
    </a>
  );
}

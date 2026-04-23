import { unstable_cache } from 'next/cache';
import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/site-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cached default-scenario proxy.
 *
 * 60s server-side TTL via unstable_cache. Most page loads hit the default
 * scenario (fast track, honest pace, no beliefs) — this keeps them off the
 * Python sim entirely and short-circuits Hobby-tier invocation budget.
 *
 * Non-default scenarios MUST keep calling /api/simulate directly. This
 * route returns data identical in shape to /api/simulate's POST response.
 */
const DEFAULT_SCENARIO = {
  track: 'fast',
  pace: 'honest',
  beliefs: {},
  iterations: 1_000_000,
  seed: null as number | null,
};

const getDefault = unstable_cache(
  async () => {
    // Prefer the private internal URL on the VPS (http://api:8001), fall
    // back to same-origin for Vercel — where the Python function handles
    // /api/simulate directly.
    const origin = process.env.INTERNAL_API_URL || SITE_URL;
    const r = await fetch(`${origin.replace(/\/$/, '')}/api/simulate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(DEFAULT_SCENARIO),
      // No next cache here — let unstable_cache govern TTL.
      cache: 'no-store',
    });
    if (!r.ok) throw new Error(`upstream ${r.status}`);
    return r.json();
  },
  ['sim-default-v1'],
  { revalidate: 60, tags: ['sim-default'] },
);

export async function GET() {
  try {
    const data = await getDefault();
    return NextResponse.json(data, {
      headers: {
        // Edge-cacheable for 60s with 5min of stale-while-revalidate.
        'cache-control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'upstream_unavailable', message: (e as Error).message },
      { status: 502 },
    );
  }
}

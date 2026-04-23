/**
 * E2E check against the deployed Derby/1M API.
 *
 * Usage:  npx tsx scripts/e2e_check.ts                       # checks prod
 *         BASE_URL=http://localhost:3000 npx tsx scripts/e2e_check.ts
 *
 * Asserts:
 *  - GET /                returns 200 HTML
 *  - GET /api/health      returns ok with field_size > 0
 *  - POST /api/simulate   returns Σ P(win) ≈ 1, no horse exactly 0, favorite has > 15% P(win)
 *  - GET /api/og          returns image/png
 *  - GET /opengraph-image returns image/png
 */

const BASE = process.env.BASE_URL?.replace(/\/$/, '') || 'https://derby1m.vercel.app';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(label: string, detail?: string) {
  passed++;
  console.log(`\x1b[32m✓\x1b[0m ${label}${detail ? `  — ${detail}` : ''}`);
}

function fail(label: string, why: string) {
  failed++;
  failures.push(`${label}: ${why}`);
  console.log(`\x1b[31m✗\x1b[0m ${label}  — ${why}`);
}

async function check<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const v = await fn();
    return v;
  } catch (e) {
    fail(label, (e as Error).message);
    return null;
  }
}

async function main() {
  console.log(`\nDerby/1M e2e — ${BASE}\n${'─'.repeat(50)}`);

  await check('GET /', async () => {
    const r = await fetch(`${BASE}/`);
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('text/html')) throw new Error(`unexpected content-type ${ct}`);
    ok('GET /', `HTTP 200, ${ct.split(';')[0]}`);
  });

  await check('GET /api/health', async () => {
    const r = await fetch(`${BASE}/api/health`);
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    const data = (await r.json()) as { status: string; field_size: number };
    if (data.status !== 'ok') throw new Error(`status=${data.status}`);
    if (!data.field_size || data.field_size < 1)
      throw new Error(`field_size=${data.field_size}`);
    ok('GET /api/health', `field_size=${data.field_size}`);
  });

  await check('POST /api/simulate', async () => {
    const t0 = Date.now();
    const r = await fetch(`${BASE}/api/simulate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        track: 'fast',
        pace: 'honest',
        beliefs: {},
        iterations: 1_000_000,
      }),
    });
    const elapsed = Date.now() - t0;
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    const data = (await r.json()) as {
      results: { name: string; p_win: number }[];
    };
    const sum = data.results.reduce((a, h) => a + h.p_win, 0);
    if (Math.abs(sum - 1) > 0.01) throw new Error(`sum P(win) = ${sum.toFixed(4)} (expected ≈1.0)`);
    const zeros = data.results.filter((h) => h.p_win === 0);
    if (zeros.length) throw new Error(`${zeros.length} horse(s) at exactly 0`);
    const fav = [...data.results].sort((a, b) => b.p_win - a.p_win)[0];
    if (fav.p_win < 0.15)
      throw new Error(`favorite ${fav.name} only ${(fav.p_win * 100).toFixed(1)}% — too flat`);
    ok(
      'POST /api/simulate',
      `ΣP=${sum.toFixed(3)}, fav=${fav.name} ${(fav.p_win * 100).toFixed(1)}%, ${elapsed}ms`,
    );
  });

  await check('GET /api/og', async () => {
    const r = await fetch(`${BASE}/api/og`);
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    const ct = r.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) throw new Error(`content-type=${ct}`);
    const len = r.headers.get('content-length');
    ok('GET /api/og', `${ct}, ${len ?? '?'} bytes`);
  });

  await check('GET /opengraph-image', async () => {
    const r = await fetch(`${BASE}/opengraph-image`, { redirect: 'follow' });
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    const ct = r.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) throw new Error(`content-type=${ct}`);
    ok('GET /opengraph-image', ct);
  });

  console.log(`${'─'.repeat(50)}`);
  console.log(`\x1b[1m${passed} passed, ${failed} failed\x1b[0m\n`);
  if (failed) {
    console.log('Failures:');
    failures.forEach((f) => console.log(`  • ${f}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('e2e harness crashed:', e);
  process.exit(2);
});

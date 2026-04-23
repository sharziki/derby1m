/**
 * Single source of truth for the site's canonical URL.
 *
 * Resolution order:
 *   1. SITE_URL            (explicit production override, set in Vercel env)
 *   2. NEXT_PUBLIC_SITE_URL (same, but available to client bundles)
 *   3. https://<VERCEL_PROJECT_PRODUCTION_URL>   (Vercel auto-inject)
 *   4. https://derby1m.vercel.app                (last-resort fallback)
 *
 * When the custom domain flips on, set `SITE_URL=https://derby1m.com` in the
 * Vercel dashboard — everything (OG, share PNG, sitemap, robots, canonical)
 * picks it up on the next deploy.
 */
export const SITE_URL: string = (() => {
  const raw =
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://derby1m.vercel.app');
  // Normalize: no trailing slash, ensure scheme.
  const withScheme = raw.startsWith('http') ? raw : `https://${raw}`;
  return withScheme.replace(/\/$/, '');
})();

/** Strip the scheme for display in places that want bare "derby1m.com". */
export const SITE_HOST: string = SITE_URL.replace(/^https?:\/\//, '');

import { buildOgImage } from '@/lib/og-template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Same image as /opengraph-image.png — exposed at /api/og for explicit testing. */
export async function GET() {
  return buildOgImage();
}

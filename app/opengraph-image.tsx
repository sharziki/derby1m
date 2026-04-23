import { buildOgImage, ogSize } from '@/lib/og-template';

export const runtime = 'nodejs';
export const alt = 'Derby/1M — One million simulated Kentucky Derbies';
export const size = ogSize;
export const contentType = 'image/png';

export default async function OGImage() {
  return buildOgImage();
}

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-url';
import { consensusReady } from '@/lib/consensus';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();
  const urls: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/methodology`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/scorecard`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
  ];
  if (await consensusReady()) {
    urls.push({
      url: `${SITE_URL}/consensus`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    });
  }
  return urls;
}

// Sitemap — one entry per public route per locale. Crawl-time only; we do
// not enumerate parcel URLs here (374 mock rows would balloon the file and
// real cadastral data lands in Sprint 7).

import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/config';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://land.trenlens.com';

const PUBLIC_PATHS = ['', '/saved'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const path of PUBLIC_PATHS) {
      entries.push({
        url: `${SITE_URL}/${locale}${path}`,
        lastModified: now,
        changeFrequency: path === '' ? 'daily' : 'weekly',
        priority: path === '' ? 1 : 0.5,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${SITE_URL}/${l}${path}`]),
          ),
        },
      });
    }
  }

  return entries;
}

import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibesafe.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: MetadataRoute.Sitemap = [
    { url: SITE_URL,                       lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${SITE_URL}/pricing`,          lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/docs`,             lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${SITE_URL}/verify`,           lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/active-test`,      lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/login`,            lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/legal/terms`,      lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${SITE_URL}/legal/privacy`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${SITE_URL}/legal/contact`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ];
  return routes;
}

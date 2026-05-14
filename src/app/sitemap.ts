import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibesafe.app';

interface RouteDef {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}

const ROUTES: RouteDef[] = [
  { path: '',               changeFrequency: 'weekly',  priority: 1.0 },
  { path: '/pricing',       changeFrequency: 'monthly', priority: 0.9 },
  { path: '/docs',          changeFrequency: 'weekly',  priority: 0.7 },
  { path: '/verify',        changeFrequency: 'monthly', priority: 0.5 },
  { path: '/active-test',   changeFrequency: 'monthly', priority: 0.5 },
  { path: '/login',         changeFrequency: 'monthly', priority: 0.4 },
  { path: '/legal/terms',   changeFrequency: 'yearly',  priority: 0.3 },
  { path: '/legal/privacy', changeFrequency: 'yearly',  priority: 0.3 },
  { path: '/legal/contact', changeFrequency: 'yearly',  priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const route of ROUTES) {
    for (const locale of routing.locales) {
      const languages: Record<string, string> = {};
      for (const l of routing.locales) {
        languages[l] = `${SITE_URL}/${l}${route.path}`;
      }
      languages['x-default'] = `${SITE_URL}/${routing.defaultLocale}${route.path}`;

      entries.push({
        url: `${SITE_URL}/${locale}${route.path}`,
        lastModified: now,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: { languages },
      });
    }
  }

  return entries;
}

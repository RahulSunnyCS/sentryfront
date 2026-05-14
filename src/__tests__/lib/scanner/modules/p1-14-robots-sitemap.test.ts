import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runRobotsSitemapModule } from '@/lib/scanner/modules/p1-14-robots-sitemap';
import type { CrawlResult } from '@/lib/scanner/types';

const baseCrawl = (): CrawlResult => ({
  finalUrl: 'https://example.com/',
  statusCode: 200,
  headers: {},
  cookies: [],
  jsBundleUrls: [],
  inlineScriptContent: '',
  html: '',
  tls: null,
  stack: '',
});

function stubRobots(robotsTxt: string, sitemapXml = '') {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => {
      const body = url.endsWith('/robots.txt')
        ? robotsTxt
        : url.endsWith('/sitemap.xml')
          ? sitemapXml
          : '';
      return {
        ok: body.length > 0,
        text: async () => body,
      } as unknown as Response;
    }),
  );
}

describe('P1-14 robots/sitemap', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Phase 3.5: anchored /api/v\\d regex', () => {
    it('does not flag public API subpaths in robots.txt (Disallow: /api/v2/docs)', async () => {
      stubRobots(`User-agent: *\nDisallow: /api/v2/docs\nDisallow: /api/v1/health\n`);
      const findings = await runRobotsSitemapModule(baseCrawl());
      expect(findings).toHaveLength(0);
    });

    it('still flags the bare API root (Disallow: /api/v2)', async () => {
      stubRobots(`User-agent: *\nDisallow: /api/v2\n`);
      const findings = await runRobotsSitemapModule(baseCrawl());
      const f = findings.find((x) => x.title.includes('sensitive path'));
      expect(f).toBeDefined();
      expect(f?.evidence).toContain('/api/v2');
    });

    it('still flags the bare API root with trailing slash (Disallow: /api/v3/)', async () => {
      stubRobots(`User-agent: *\nDisallow: /api/v3/\n`);
      const findings = await runRobotsSitemapModule(baseCrawl());
      expect(findings.find((x) => x.title.includes('sensitive path'))).toBeDefined();
    });
  });

  describe('Other sensitive patterns still match', () => {
    it('flags Disallow: /admin', async () => {
      stubRobots(`User-agent: *\nDisallow: /admin\n`);
      const findings = await runRobotsSitemapModule(baseCrawl());
      expect(findings.find((x) => x.title.includes('sensitive path'))).toBeDefined();
    });

    it('flags Disallow: /.env', async () => {
      stubRobots(`User-agent: *\nDisallow: /.env\n`);
      const findings = await runRobotsSitemapModule(baseCrawl());
      expect(findings.find((x) => x.title.includes('sensitive path'))).toBeDefined();
    });
  });

  describe('robots.txt absent → no findings', () => {
    it('returns no findings when both files are empty', async () => {
      stubRobots('', '');
      const findings = await runRobotsSitemapModule(baseCrawl());
      expect(findings).toHaveLength(0);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { runCacheModule } from '@/lib/scanner/modules/p1-15-cache';
import type { CrawlResult, ParsedCookie } from '@/lib/scanner/types';

const cookie = (name: string): ParsedCookie => ({
  name,
  value: 'x',
  secure: true,
  httpOnly: true,
  sameSite: 'Lax',
  domain: null,
  path: null,
});

const crawl = (cookies: ParsedCookie[], headers: Record<string, string> = {}): CrawlResult => ({
  finalUrl: 'https://example.com',
  statusCode: 200,
  headers,
  cookies,
  jsBundleUrls: [],
  inlineScriptContent: '',
  html: '',
  tls: null,
  stack: '',
});

describe('P1-15 cache', () => {
  describe('Phase 3.5: tracking cookies should not gate cache findings', () => {
    it('does not flag a page that sets only Google Analytics cookies', () => {
      const findings = runCacheModule(crawl([cookie('_ga'), cookie('_gid')]));
      expect(findings).toHaveLength(0);
    });

    it('does not flag a page that sets only Facebook tracking cookies', () => {
      const findings = runCacheModule(crawl([cookie('_fbp'), cookie('_gcl_au')]));
      expect(findings).toHaveLength(0);
    });

    it('does not flag a page that sets only intercom/mixpanel cookies', () => {
      const findings = runCacheModule(crawl([cookie('intercom-id'), cookie('mp_mixpanel')]));
      expect(findings).toHaveLength(0);
    });
  });

  describe('Real session cookies still gate cache findings', () => {
    it('flags missing Cache-Control on response with session cookie', () => {
      const findings = runCacheModule(crawl([cookie('session')]));
      expect(findings.some((f) => f.title.includes('No Cache-Control'))).toBe(true);
    });

    it('does not flag when Cache-Control: no-store is set', () => {
      const findings = runCacheModule(
        crawl([cookie('session')], { 'cache-control': 'no-store' }),
      );
      expect(findings).toHaveLength(0);
    });

    it('flags weak Cache-Control (public, max-age=600) with session cookie', () => {
      const findings = runCacheModule(
        crawl([cookie('connect.sid')], { 'cache-control': 'public, max-age=600' }),
      );
      expect(findings.some((f) => f.title.includes('may be cached'))).toBe(true);
    });
  });

  describe('Auth headers still gate cache findings independent of cookies', () => {
    it('flags when Authorization header is present even without session cookies', () => {
      const findings = runCacheModule(
        crawl([cookie('_ga')], { authorization: 'Bearer x' }),
      );
      expect(findings.some((f) => f.title.includes('No Cache-Control'))).toBe(true);
    });
  });
});

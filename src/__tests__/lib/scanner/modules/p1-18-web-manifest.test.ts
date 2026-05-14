import { describe, it, expect } from 'vitest';
import { runWebManifestModule } from '@/lib/scanner/modules/p1-18-web-manifest';
import type { CrawlResult } from '@/lib/scanner/types';

function crawl(opts: {
  finalUrl?: string;
  manifestUrl?: string;
  manifestJson?: string;
}): CrawlResult {
  return {
    finalUrl: opts.finalUrl ?? 'https://example.com/',
    statusCode: 200,
    headers: {},
    cookies: [],
    jsBundleUrls: [],
    inlineScriptContent: '',
    html: '',
    tls: null,
    stack: '',
    manifestUrl: opts.manifestUrl,
    manifestJson: opts.manifestJson,
  };
}

describe('P1-18 web manifest — Phase 3.8.4', () => {
  describe('no manifest', () => {
    it('returns no findings when manifestUrl is undefined', () => {
      expect(runWebManifestModule(crawl({}))).toEqual([]);
    });
  });

  describe('linked-but-fail (LOW)', () => {
    it('flags a manifest URL with no body', () => {
      const findings = runWebManifestModule(
        crawl({ manifestUrl: 'https://example.com/manifest.json', manifestJson: undefined }),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('LOW');
      expect(findings[0].title).toContain('not fetchable');
    });

    it('flags a manifest body that does not parse as JSON', () => {
      const findings = runWebManifestModule(
        crawl({
          manifestUrl: 'https://example.com/manifest.json',
          manifestJson: '<html>not the manifest</html>',
        }),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('LOW');
      expect(findings[0].title).toContain('does not parse as JSON');
    });
  });

  describe('internal hostnames (MEDIUM)', () => {
    it('flags a manifest referencing a .internal hostname', () => {
      const findings = runWebManifestModule(
        crawl({
          manifestUrl: 'https://example.com/manifest.json',
          manifestJson: JSON.stringify({
            name: 'App',
            scope: '/',
            start_url: 'https://api.example.internal/launch',
          }),
        }),
      );
      const f = findings.find((x) => x.title.includes('internal hostnames'));
      expect(f).toBeDefined();
      expect(f?.severity).toBe('MEDIUM');
      expect(f?.evidence).toContain('.internal');
    });

    it('flags an RFC1918 IP address embedded in the manifest', () => {
      const findings = runWebManifestModule(
        crawl({
          manifestUrl: 'https://example.com/manifest.json',
          manifestJson: JSON.stringify({
            name: 'App',
            description: 'see http://10.0.5.12/docs',
          }),
        }),
      );
      expect(findings.find((x) => x.title.includes('internal hostnames'))).toBeDefined();
    });

    it('does NOT flag a clean manifest', () => {
      const findings = runWebManifestModule(
        crawl({
          manifestUrl: 'https://example.com/manifest.json',
          manifestJson: JSON.stringify({
            name: 'App',
            scope: '/',
            start_url: '/',
          }),
        }),
      );
      expect(findings.find((x) => x.title.includes('internal hostnames'))).toBeUndefined();
    });
  });

  describe('developer email leakage (MEDIUM)', () => {
    it('flags an email address anywhere in the manifest with redacted evidence', () => {
      const findings = runWebManifestModule(
        crawl({
          manifestUrl: 'https://example.com/manifest.json',
          manifestJson: JSON.stringify({
            name: 'App',
            developer: 'alice.smith@internal.corp',
          }),
        }),
      );
      const f = findings.find((x) => x.title.includes('developer email'));
      expect(f).toBeDefined();
      expect(f?.severity).toBe('MEDIUM');
      // Evidence should be redacted (al***@…)
      expect(f?.evidence).toContain('***@');
      expect(f?.evidence).not.toContain('alice.smith@internal.corp');
    });

    it('does NOT flag a manifest with no email-shaped string', () => {
      const findings = runWebManifestModule(
        crawl({
          manifestUrl: 'https://example.com/manifest.json',
          manifestJson: JSON.stringify({ name: 'App', short_name: 'A' }),
        }),
      );
      expect(findings.find((x) => x.title.includes('developer email'))).toBeUndefined();
    });
  });

  describe('scope overreach (MEDIUM)', () => {
    it('flags scope=/ when the manifest lives at /app/manifest.json', () => {
      const findings = runWebManifestModule(
        crawl({
          manifestUrl: 'https://example.com/app/manifest.json',
          manifestJson: JSON.stringify({ name: 'App', scope: '/' }),
        }),
      );
      const f = findings.find((x) => x.title.includes('scope claims more URL space'));
      expect(f).toBeDefined();
      expect(f?.severity).toBe('MEDIUM');
    });

    it('does NOT flag scope=/ when the manifest lives at /manifest.json', () => {
      const findings = runWebManifestModule(
        crawl({
          manifestUrl: 'https://example.com/manifest.json',
          manifestJson: JSON.stringify({ name: 'App', scope: '/' }),
        }),
      );
      expect(findings.find((x) => x.title.includes('scope claims more URL space'))).toBeUndefined();
    });
  });

  describe('tracking params in start_url (LOW)', () => {
    it('flags utm_source in start_url', () => {
      const findings = runWebManifestModule(
        crawl({
          manifestUrl: 'https://example.com/manifest.json',
          manifestJson: JSON.stringify({
            name: 'App',
            start_url: '/?utm_source=pwa&utm_medium=install',
          }),
        }),
      );
      const f = findings.find((x) => x.title.includes('start_url contains tracking'));
      expect(f).toBeDefined();
      expect(f?.severity).toBe('LOW');
      expect(f?.evidence).toContain('utm_source');
    });

    it('does NOT flag start_url with no tracking params', () => {
      const findings = runWebManifestModule(
        crawl({
          manifestUrl: 'https://example.com/manifest.json',
          manifestJson: JSON.stringify({ name: 'App', start_url: '/' }),
        }),
      );
      expect(findings.find((x) => x.title.includes('start_url contains tracking'))).toBeUndefined();
    });
  });
});

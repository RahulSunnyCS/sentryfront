import { describe, it, expect } from 'vitest';
import { runServiceWorkerModule } from '@/lib/scanner/modules/p1-17-service-worker';
import type { CrawlResult, SwRegistrationRecord } from '@/lib/scanner/types';

function crawl(opts: {
  finalUrl?: string;
  registrations?: SwRegistrationRecord[];
  scripts?: Record<string, string>;
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
    serviceWorkerRegistrations: opts.registrations,
    serviceWorkerScripts: opts.scripts,
  };
}

describe('P1-17 service worker — Phase 3.8.4', () => {
  describe('no SW registered', () => {
    it('returns no findings when serviceWorkerRegistrations is undefined', () => {
      expect(runServiceWorkerModule(crawl({}))).toEqual([]);
    });

    it('returns no findings when registrations array is empty', () => {
      expect(runServiceWorkerModule(crawl({ registrations: [] }))).toEqual([]);
    });
  });

  describe('open fetch handler (HIGH)', () => {
    it('flags a blindly-forwarding fetch handler', () => {
      const findings = runServiceWorkerModule(
        crawl({
          finalUrl: 'https://example.com/',
          registrations: [{ url: 'https://example.com/sw.js', scope: '/' }],
          scripts: {
            'https://example.com/sw.js': `
              self.addEventListener('fetch', (event) => {
                event.respondWith(fetch(event.request));
              });
            `,
          },
        }),
      );
      const f = findings.find((x) => x.title.includes('forwards arbitrary fetch'));
      expect(f).toBeDefined();
      expect(f?.severity).toBe('HIGH');
    });

    it('does NOT flag when the handler checks request origin first', () => {
      const findings = runServiceWorkerModule(
        crawl({
          finalUrl: 'https://example.com/',
          registrations: [{ url: 'https://example.com/sw.js', scope: '/' }],
          scripts: {
            'https://example.com/sw.js': `
              self.addEventListener('fetch', (event) => {
                if (new URL(event.request.url).origin !== self.origin) return;
                event.respondWith(fetch(event.request));
              });
            `,
          },
        }),
      );
      expect(findings.find((x) => x.title.includes('forwards arbitrary fetch'))).toBeUndefined();
    });
  });

  describe('overprivileged scope (MEDIUM)', () => {
    it('flags scope=/ on an app served at /app/', () => {
      const findings = runServiceWorkerModule(
        crawl({
          finalUrl: 'https://example.com/app/dashboard',
          registrations: [{ url: 'https://example.com/sw.js', scope: '/' }],
        }),
      );
      const f = findings.find((x) => x.title.includes('Overprivileged service-worker scope'));
      expect(f).toBeDefined();
      expect(f?.severity).toBe('MEDIUM');
    });

    it('does NOT flag scope=/ when the page itself is at /', () => {
      const findings = runServiceWorkerModule(
        crawl({
          finalUrl: 'https://example.com/',
          registrations: [{ url: 'https://example.com/sw.js', scope: '/' }],
        }),
      );
      expect(findings.find((x) => x.title.includes('Overprivileged'))).toBeUndefined();
    });
  });

  describe('cross-origin importScripts (LOW)', () => {
    it('flags an importScripts call to a different origin', () => {
      const findings = runServiceWorkerModule(
        crawl({
          finalUrl: 'https://example.com/',
          registrations: [{ url: 'https://example.com/sw.js', scope: '/' }],
          scripts: {
            'https://example.com/sw.js': `importScripts('https://cdn.somewhere.io/sw-lib.js');`,
          },
        }),
      );
      const f = findings.find((x) => x.title.includes('cross-origin script'));
      expect(f).toBeDefined();
      expect(f?.severity).toBe('LOW');
      expect(f?.evidence).toContain('cdn.somewhere.io');
    });

    it('does NOT flag same-origin importScripts', () => {
      const findings = runServiceWorkerModule(
        crawl({
          finalUrl: 'https://example.com/',
          registrations: [{ url: 'https://example.com/sw.js', scope: '/' }],
          scripts: {
            'https://example.com/sw.js': `importScripts('https://example.com/sw-lib.js');`,
          },
        }),
      );
      expect(findings.find((x) => x.title.includes('cross-origin script'))).toBeUndefined();
    });
  });

  describe('sensitive-header caching (MEDIUM, low-confidence)', () => {
    it('flags cache.put paired with Authorization', () => {
      const findings = runServiceWorkerModule(
        crawl({
          finalUrl: 'https://example.com/',
          registrations: [{ url: 'https://example.com/sw.js', scope: '/' }],
          scripts: {
            'https://example.com/sw.js': `
              caches.open('v1').then(c => c.put(req, res));
              // headers.Authorization is sometimes set on req above
              req.headers.set('Authorization', 'Bearer x');
            `,
          },
        }),
      );
      const f = findings.find((x) => x.title.includes('Authorization or Cookie'));
      expect(f).toBeDefined();
      expect(f?.severity).toBe('MEDIUM');
      expect(f?.confidence).toBe('low');
    });

    it('does NOT flag a cache.put without nearby Authorization / Cookie', () => {
      const findings = runServiceWorkerModule(
        crawl({
          finalUrl: 'https://example.com/',
          registrations: [{ url: 'https://example.com/sw.js', scope: '/' }],
          scripts: {
            'https://example.com/sw.js': `caches.open('v1').then(c => c.put('/static/app.js', res));`,
          },
        }),
      );
      expect(findings.find((x) => x.title.includes('Authorization or Cookie'))).toBeUndefined();
    });
  });
});

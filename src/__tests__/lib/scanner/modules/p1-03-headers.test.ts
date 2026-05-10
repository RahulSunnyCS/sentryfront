import { describe, it, expect } from 'vitest';
import { runHeadersModule } from '@/lib/scanner/modules/p1-03-headers';
import type { CrawlResult } from '@/lib/scanner/types';

const createCrawlResult = (headers: Record<string, string>): CrawlResult => ({
  finalUrl: 'https://example.com',
  html: '',
  headers,
  cookies: [],
  localStorage: {},
  sessionStorage: {},
  scripts: [],
  links: [],
  resources: [],
  statusCode: 200,
  inlineScriptContent: '',
  jsBundleUrls: [],
});

describe('P1-03: Security Headers Module', () => {
  describe('Content-Security-Policy', () => {
    it('should flag missing CSP header', async () => {
      const crawlResult = createCrawlResult({});
      const findings = await runHeadersModule(crawlResult);

      const cspFinding = findings.find(f => f.title.includes('Content-Security-Policy'));
      expect(cspFinding).toBeDefined();
      expect(cspFinding?.severity).toBe('MEDIUM');
      expect(cspFinding?.category).toBe('Security Headers');
    });

    it('should not flag when CSP is present', async () => {
      const crawlResult = createCrawlResult({
        'content-security-policy': "default-src 'self'",
      });
      const findings = await runHeadersModule(crawlResult);

      const cspFinding = findings.find(f => f.title.includes('Content-Security-Policy'));
      expect(cspFinding).toBeUndefined();
    });
  });

  describe('Strict-Transport-Security (HSTS)', () => {
    it('should flag missing HSTS header', async () => {
      const crawlResult = createCrawlResult({});
      const findings = await runHeadersModule(crawlResult);

      const hstsFinding = findings.find(f => f.title.includes('Strict-Transport-Security'));
      expect(hstsFinding).toBeDefined();
      expect(hstsFinding?.severity).toBe('MEDIUM');
    });

    it('should not flag when HSTS is present', async () => {
      const crawlResult = createCrawlResult({
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
      });
      const findings = await runHeadersModule(crawlResult);

      const hstsFinding = findings.find(f => f.title.includes('Strict-Transport-Security'));
      expect(hstsFinding).toBeUndefined();
    });
  });

  describe('X-Frame-Options', () => {
    it('should flag missing X-Frame-Options header', async () => {
      const crawlResult = createCrawlResult({});
      const findings = await runHeadersModule(crawlResult);

      const xfoFinding = findings.find(f => f.title.includes('X-Frame-Options'));
      expect(xfoFinding).toBeDefined();
      expect(xfoFinding?.severity).toBe('LOW');
    });

    it('should not flag when X-Frame-Options is set', async () => {
      const crawlResult = createCrawlResult({
        'x-frame-options': 'SAMEORIGIN',
      });
      const findings = await runHeadersModule(crawlResult);

      const xfoFinding = findings.find(f => f.title.includes('X-Frame-Options'));
      expect(xfoFinding).toBeUndefined();
    });
  });

  describe('X-Content-Type-Options', () => {
    it('should flag missing X-Content-Type-Options header', async () => {
      const crawlResult = createCrawlResult({});
      const findings = await runHeadersModule(crawlResult);

      const xctoFinding = findings.find(f => f.title.includes('X-Content-Type-Options'));
      expect(xctoFinding).toBeDefined();
      expect(xctoFinding?.severity).toBe('LOW');
    });

    it('should not flag when X-Content-Type-Options is set to nosniff', async () => {
      const crawlResult = createCrawlResult({
        'x-content-type-options': 'nosniff',
      });
      const findings = await runHeadersModule(crawlResult);

      const xctoFinding = findings.find(f => f.title.includes('X-Content-Type-Options'));
      expect(xctoFinding).toBeUndefined();
    });
  });

  describe('Referrer-Policy', () => {
    it('should flag missing Referrer-Policy header', async () => {
      const crawlResult = createCrawlResult({});
      const findings = await runHeadersModule(crawlResult);

      const rpFinding = findings.find(f => f.title.includes('Referrer-Policy'));
      expect(rpFinding).toBeDefined();
      expect(rpFinding?.severity).toBe('INFO');
    });

    it('should not flag when Referrer-Policy is present', async () => {
      const crawlResult = createCrawlResult({
        'referrer-policy': 'strict-origin-when-cross-origin',
      });
      const findings = await runHeadersModule(crawlResult);

      const rpFinding = findings.find(f => f.title.includes('Referrer-Policy'));
      expect(rpFinding).toBeUndefined();
    });
  });

  describe('Permissions-Policy', () => {
    it('should flag missing Permissions-Policy header', async () => {
      const crawlResult = createCrawlResult({});
      const findings = await runHeadersModule(crawlResult);

      const ppFinding = findings.find(f => f.title.includes('Permissions-Policy'));
      expect(ppFinding).toBeDefined();
      expect(ppFinding?.severity).toBe('INFO');
    });

    it('should not flag when Permissions-Policy is present', async () => {
      const crawlResult = createCrawlResult({
        'permissions-policy': 'camera=(), microphone=()',
      });
      const findings = await runHeadersModule(crawlResult);

      const ppFinding = findings.find(f => f.title.includes('Permissions-Policy'));
      expect(ppFinding).toBeUndefined();
    });
  });

  describe('Multiple missing headers', () => {
    it('should return multiple findings when all headers are missing', async () => {
      const crawlResult = createCrawlResult({});
      const findings = await runHeadersModule(crawlResult);

      expect(findings.length).toBeGreaterThanOrEqual(5);
      expect(findings.every(f => f.moduleId === 'P1-03')).toBe(true);
    });

    it('should return no findings when all security headers are present', async () => {
      const crawlResult = createCrawlResult({
        'content-security-policy': "default-src 'self'",
        'strict-transport-security': 'max-age=31536000',
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'permissions-policy': 'camera=()',
      });
      const findings = await runHeadersModule(crawlResult);

      expect(findings).toHaveLength(0);
    });
  });
});

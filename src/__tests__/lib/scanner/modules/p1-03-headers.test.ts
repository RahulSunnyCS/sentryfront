import { describe, it, expect } from 'vitest';
import { runHeadersModule } from '@/lib/scanner/modules/p1-03-headers';
import type { CrawlResult } from '@/lib/scanner/types';

const createCrawlResult = (
  headers: Record<string, string>,
  overrides: Partial<CrawlResult> = {},
): CrawlResult => ({
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
  ...overrides,
} as CrawlResult);

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
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-embedder-policy': 'require-corp',
      });
      const findings = await runHeadersModule(crawlResult);

      expect(findings).toHaveLength(0);
    });
  });

  // ── Phase 3.8: coverage-gap additions ────────────────────────────────────

  describe('Referrer-Policy value sanity (3.8)', () => {
    it('flags unsafe-url as a weak value', async () => {
      const crawlResult = createCrawlResult({ 'referrer-policy': 'unsafe-url' });
      const findings = await runHeadersModule(crawlResult);

      const weak = findings.find(f => f.title === 'Weak Referrer-Policy value');
      expect(weak).toBeDefined();
      expect(weak?.severity).toBe('INFO');
      expect(weak?.evidence).toContain('unsafe-url');
    });

    it('flags no-referrer-when-downgrade as a weak value', async () => {
      const crawlResult = createCrawlResult({
        'referrer-policy': 'no-referrer-when-downgrade',
      });
      const findings = await runHeadersModule(crawlResult);

      expect(findings.find(f => f.title === 'Weak Referrer-Policy value')).toBeDefined();
    });

    it('does not flag strict-origin-when-cross-origin', async () => {
      const crawlResult = createCrawlResult({
        'referrer-policy': 'strict-origin-when-cross-origin',
      });
      const findings = await runHeadersModule(crawlResult);

      expect(findings.find(f => f.title.includes('Referrer-Policy'))).toBeUndefined();
    });
  });

  describe('Permissions-Policy value sanity (3.8)', () => {
    it('flags wildcard allowlist on a sensitive feature (camera=*)', async () => {
      const crawlResult = createCrawlResult({
        'permissions-policy': 'camera=*, microphone=()',
      });
      const findings = await runHeadersModule(crawlResult);

      const weak = findings.find(f => f.title === 'Overly permissive Permissions-Policy directive');
      expect(weak).toBeDefined();
      expect(weak?.severity).toBe('INFO');
      expect(weak?.evidence).toContain('camera=*');
    });

    it('flags wildcard on geolocation', async () => {
      const crawlResult = createCrawlResult({
        'permissions-policy': 'geolocation=*',
      });
      const findings = await runHeadersModule(crawlResult);

      expect(findings.find(f => f.title === 'Overly permissive Permissions-Policy directive')).toBeDefined();
    });

    it('does not flag scoped allowlists on sensitive features', async () => {
      const crawlResult = createCrawlResult({
        'permissions-policy': 'camera=(self), microphone=(), geolocation=("https://maps.example.com")',
      });
      const findings = await runHeadersModule(crawlResult);

      expect(findings.find(f => f.title.includes('Permissions-Policy'))).toBeUndefined();
    });

    it('does not flag wildcard on a non-sensitive directive (fullscreen=*)', async () => {
      const crawlResult = createCrawlResult({
        'permissions-policy': 'fullscreen=*',
      });
      const findings = await runHeadersModule(crawlResult);

      expect(findings.find(f => f.title.includes('Permissions-Policy'))).toBeUndefined();
    });
  });

  describe('Cross-Origin-Opener-Policy / COOP (3.8)', () => {
    it('flags missing COOP header', async () => {
      const crawlResult = createCrawlResult({});
      const findings = await runHeadersModule(crawlResult);

      const coop = findings.find(f => f.title.includes('Cross-Origin-Opener-Policy'));
      expect(coop).toBeDefined();
      expect(coop?.severity).toBe('INFO');
    });

    it('flags unsafe-none as a weak value', async () => {
      const crawlResult = createCrawlResult({
        'cross-origin-opener-policy': 'unsafe-none',
      });
      const findings = await runHeadersModule(crawlResult);

      const coop = findings.find(f => f.title === 'Weak Cross-Origin-Opener-Policy value');
      expect(coop).toBeDefined();
      expect(coop?.evidence).toContain('unsafe-none');
    });

    it('does not flag same-origin', async () => {
      const crawlResult = createCrawlResult({
        'cross-origin-opener-policy': 'same-origin',
      });
      const findings = await runHeadersModule(crawlResult);

      expect(findings.find(f => f.title.includes('Cross-Origin-Opener-Policy'))).toBeUndefined();
    });

    it('does not flag same-origin-allow-popups', async () => {
      const crawlResult = createCrawlResult({
        'cross-origin-opener-policy': 'same-origin-allow-popups',
      });
      const findings = await runHeadersModule(crawlResult);

      expect(findings.find(f => f.title.includes('Cross-Origin-Opener-Policy'))).toBeUndefined();
    });
  });

  describe('Cross-Origin-Embedder-Policy / COEP (3.8)', () => {
    it('flags missing COEP header', async () => {
      const crawlResult = createCrawlResult({});
      const findings = await runHeadersModule(crawlResult);

      const coep = findings.find(f => f.title.includes('Cross-Origin-Embedder-Policy'));
      expect(coep).toBeDefined();
      expect(coep?.severity).toBe('INFO');
    });

    it('flags unsafe-none as a weak value', async () => {
      const crawlResult = createCrawlResult({
        'cross-origin-embedder-policy': 'unsafe-none',
      });
      const findings = await runHeadersModule(crawlResult);

      expect(findings.find(f => f.title === 'Weak Cross-Origin-Embedder-Policy value')).toBeDefined();
    });

    it('does not flag require-corp', async () => {
      const crawlResult = createCrawlResult({
        'cross-origin-embedder-policy': 'require-corp',
      });
      const findings = await runHeadersModule(crawlResult);

      expect(findings.find(f => f.title.includes('Cross-Origin-Embedder-Policy'))).toBeUndefined();
    });

    it('does not flag credentialless', async () => {
      const crawlResult = createCrawlResult({
        'cross-origin-embedder-policy': 'credentialless',
      });
      const findings = await runHeadersModule(crawlResult);

      expect(findings.find(f => f.title.includes('Cross-Origin-Embedder-Policy'))).toBeUndefined();
    });
  });

  describe('Subresource Integrity / SRI (3.8)', () => {
    const sriTitle = 'Cross-origin scripts loaded without Subresource Integrity (SRI)';

    it('flags cross-origin scripts without integrity', async () => {
      const crawlResult = createCrawlResult(
        {},
        {
          html: `
            <html><head>
              <script src="https://cdn.example.net/jquery-3.6.0.min.js"></script>
              <script src="https://cdn.other.com/lib.js"></script>
            </head><body></body></html>
          `,
        },
      );
      const findings = await runHeadersModule(crawlResult);

      const sri = findings.find(f => f.title === sriTitle);
      expect(sri).toBeDefined();
      expect(sri?.severity).toBe('LOW');
      expect(sri?.evidence).toContain('https://cdn.example.net/jquery-3.6.0.min.js');
      expect(sri?.evidence).toContain('https://cdn.other.com/lib.js');
    });

    it('does not flag cross-origin scripts that have an integrity attribute', async () => {
      const crawlResult = createCrawlResult(
        {},
        {
          html: `<script src="https://cdn.example.net/jquery.min.js"
                         integrity="sha384-abc123" crossorigin="anonymous"></script>`,
        },
      );
      const findings = await runHeadersModule(crawlResult);

      expect(findings.find(f => f.title === sriTitle)).toBeUndefined();
    });

    it('does not flag same-origin scripts', async () => {
      const crawlResult = createCrawlResult(
        {},
        {
          finalUrl: 'https://example.com/page',
          html: `
            <script src="/static/app.js"></script>
            <script src="https://example.com/static/vendor.js"></script>
          `,
        },
      );
      const findings = await runHeadersModule(crawlResult);

      expect(findings.find(f => f.title === sriTitle)).toBeUndefined();
    });

    it('truncates evidence to 5 URLs and reports the remainder count', async () => {
      const scripts = Array.from(
        { length: 8 },
        (_, i) => `<script src="https://cdn${i}.example.net/lib.js"></script>`,
      ).join('\n');
      const crawlResult = createCrawlResult({}, { html: scripts });
      const findings = await runHeadersModule(crawlResult);

      const sri = findings.find(f => f.title === sriTitle);
      expect(sri).toBeDefined();
      expect(sri?.evidence).toContain('cdn0.example.net');
      expect(sri?.evidence).toContain('cdn4.example.net');
      expect(sri?.evidence).not.toContain('cdn5.example.net');
      expect(sri?.evidence).toContain('(and 3 more)');
    });

    it('prefers cleanedHtml over html when present (suppresses code-snippet FPs)', async () => {
      const crawlResult = createCrawlResult(
        {},
        {
          html: `<pre><code><script src="https://cdn.docs.example/x.js"></script></code></pre>`,
          cleanedHtml: '<pre><code></code></pre>',
        },
      );
      const findings = await runHeadersModule(crawlResult);

      expect(findings.find(f => f.title === sriTitle)).toBeUndefined();
    });
  });
});

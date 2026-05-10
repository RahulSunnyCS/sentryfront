import { describe, it, expect } from 'vitest';
import { runMixedContentModule } from '@/lib/scanner/modules/p1-08-mixed-content';
import type { CrawlResult } from '@/lib/scanner/types';

const createCrawlResult = (finalUrl: string, html: string): CrawlResult => ({
  finalUrl,
  html,
  headers: {},
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

describe('P1-08: Mixed Content Module', () => {
  describe('HTTP Scripts on HTTPS', () => {
    it('should flag HTTP scripts on HTTPS pages as HIGH severity', () => {
      const html = `
        <html>
          <head>
            <script src="http://example.com/app.js"></script>
            <script src="http://cdn.example.com/lib.js"></script>
          </head>
        </html>
      `;
      const crawlResult = createCrawlResult('https://example.com', html);
      const findings = runMixedContentModule(crawlResult);

      const scriptFinding = findings.find(f => f.title.includes('script'));
      expect(scriptFinding).toBeDefined();
      expect(scriptFinding?.severity).toBe('HIGH');
      expect(scriptFinding?.title).toContain('2 scripts');
    });
  });

  describe('HTTP Forms on HTTPS', () => {
    it('should flag HTTP form actions on HTTPS pages', () => {
      const html = `
        <html>
          <body>
            <form action="http://example.com/submit" method="POST">
              <input type="text" name="data" />
            </form>
          </body>
        </html>
      `;
      const crawlResult = createCrawlResult('https://example.com', html);
      const findings = runMixedContentModule(crawlResult);

      const formFinding = findings.find(f => f.title.includes('Form'));
      expect(formFinding).toBeDefined();
      expect(formFinding?.severity).toBe('HIGH');
    });
  });

  describe('HTTP Passive Resources', () => {
    it('should flag HTTP images as MEDIUM severity', () => {
      const html = `
        <html>
          <body>
            <img src="http://example.com/image.jpg" />
            <img src="http://cdn.example.com/logo.png" />
          </body>
        </html>
      `;
      const crawlResult = createCrawlResult('https://example.com', html);
      const findings = runMixedContentModule(crawlResult);

      const passiveFinding = findings.find(f => f.title.includes('passive resource'));
      expect(passiveFinding).toBeDefined();
      expect(passiveFinding?.severity).toBe('MEDIUM');
    });

    it('should flag HTTP iframes', () => {
      const html = `
        <html>
          <body>
            <iframe src="http://example.com/embed"></iframe>
          </body>
        </html>
      `;
      const crawlResult = createCrawlResult('https://example.com', html);
      const findings = runMixedContentModule(crawlResult);

      expect(findings.length).toBeGreaterThan(0);
      const passiveFinding = findings.find(f => f.title.includes('passive'));
      expect(passiveFinding).toBeDefined();
    });
  });

  describe('HTTP Pages', () => {
    it('should not flag mixed content on HTTP pages', () => {
      const html = `
        <html>
          <head>
            <script src="http://example.com/app.js"></script>
          </head>
          <body>
            <img src="http://example.com/image.jpg" />
          </body>
        </html>
      `;
      const crawlResult = createCrawlResult('http://example.com', html);
      const findings = runMixedContentModule(crawlResult);

      expect(findings).toHaveLength(0);
    });
  });

  describe('Clean HTTPS Pages', () => {
    it('should not flag pages with only HTTPS resources', () => {
      const html = `
        <html>
          <head>
            <script src="https://example.com/app.js"></script>
            <link rel="stylesheet" href="https://example.com/style.css" />
          </head>
          <body>
            <img src="https://example.com/image.jpg" />
            <form action="https://example.com/submit" method="POST"></form>
          </body>
        </html>
      `;
      const crawlResult = createCrawlResult('https://example.com', html);
      const findings = runMixedContentModule(crawlResult);

      expect(findings).toHaveLength(0);
    });
  });

  describe('Multiple Mixed Content Types', () => {
    it('should create separate findings for scripts, forms, and passive content', () => {
      const html = `
        <html>
          <head>
            <script src="http://example.com/app.js"></script>
          </head>
          <body>
            <img src="http://example.com/image.jpg" />
            <form action="http://example.com/submit" method="POST"></form>
          </body>
        </html>
      `;
      const crawlResult = createCrawlResult('https://example.com', html);
      const findings = runMixedContentModule(crawlResult);

      expect(findings).toHaveLength(3);
      expect(findings.some(f => f.title.includes('script'))).toBe(true);
      expect(findings.some(f => f.title.includes('Form'))).toBe(true);
      expect(findings.some(f => f.title.includes('passive'))).toBe(true);
    });
  });
});

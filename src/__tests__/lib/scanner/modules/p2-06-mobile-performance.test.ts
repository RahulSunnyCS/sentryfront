import { describe, it, expect } from 'vitest';
import { runMobilePerformanceModule } from '@/lib/scanner/modules/p2-06-mobile-performance';
import type { CrawlResult } from '@/lib/scanner/types';

const createMockCrawlResult = (html: string): CrawlResult => ({
  finalUrl: 'https://example.com',
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

describe('P2-06: Mobile Performance Module', () => {
  describe('Viewport meta tag', () => {
    it('should detect missing viewport meta tag', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Page</title>
        </head>
        <body>Content</body>
        </html>
      `;

      const crawlResult = createMockCrawlResult(html);
      const findings = runMobilePerformanceModule(crawlResult);

      const viewportFinding = findings.find(f => f.title.includes('Missing viewport meta tag'));
      expect(viewportFinding).toBeDefined();
      expect(viewportFinding?.severity).toBe('MEDIUM');
      expect(viewportFinding?.category).toBe('Performance');
    });

    it('should not flag when viewport meta tag is present', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Test Page</title>
        </head>
        <body>Content</body>
        </html>
      `;

      const crawlResult = createMockCrawlResult(html);
      const findings = runMobilePerformanceModule(crawlResult);

      const viewportFinding = findings.find(f => f.title.includes('Missing viewport meta tag'));
      expect(viewportFinding).toBeUndefined();
    });

    it('should detect viewport with user-scalable=no', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
          <title>Test Page</title>
        </head>
        <body>Content</body>
        </html>
      `;

      const crawlResult = createMockCrawlResult(html);
      const findings = runMobilePerformanceModule(crawlResult);

      const scalingFinding = findings.find(f => f.title.includes('prevents user scaling'));
      expect(scalingFinding).toBeDefined();
      expect(scalingFinding?.severity).toBe('LOW');
      expect(scalingFinding?.category).toBe('Performance');
    });

    it('should detect viewport with maximum-scale=1', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
          <title>Test Page</title>
        </head>
        <body>Content</body>
        </html>
      `;

      const crawlResult = createMockCrawlResult(html);
      const findings = runMobilePerformanceModule(crawlResult);

      const scalingFinding = findings.find(f => f.title.includes('prevents user scaling'));
      expect(scalingFinding).toBeDefined();
      expect(scalingFinding?.severity).toBe('LOW');
    });

    it('should detect viewport without width=device-width', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="initial-scale=1">
          <title>Test Page</title>
        </head>
        <body>Content</body>
        </html>
      `;

      const crawlResult = createMockCrawlResult(html);
      const findings = runMobilePerformanceModule(crawlResult);

      const widthFinding = findings.find(f => f.title.includes('not set to device width'));
      expect(widthFinding).toBeDefined();
      expect(widthFinding?.severity).toBe('LOW');
    });

    it('should handle single quotes in viewport tag', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name='viewport' content='width=device-width, initial-scale=1'>
          <title>Test Page</title>
        </head>
        <body>Content</body>
        </html>
      `;

      const crawlResult = createMockCrawlResult(html);
      const findings = runMobilePerformanceModule(crawlResult);

      const viewportFinding = findings.find(f => f.title.includes('Missing viewport meta tag'));
      expect(viewportFinding).toBeUndefined();
    });
  });

  describe('Perfect mobile configuration', () => {
    it('should return no findings for optimal viewport configuration', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Mobile-Friendly Page</title>
        </head>
        <body>Content</body>
        </html>
      `;

      const crawlResult = createMockCrawlResult(html);
      const findings = runMobilePerformanceModule(crawlResult);

      expect(findings).toHaveLength(0);
    });
  });
});

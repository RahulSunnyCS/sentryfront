import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runCorsModule } from '@/lib/scanner/modules/p1-07-cors';
import type { CrawlResult } from '@/lib/scanner/types';

const createCrawlResult = (finalUrl: string, html = ''): CrawlResult => ({
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

describe('P1-07: CORS Configuration Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockReset();
  });

  describe('Wildcard CORS with Credentials', () => {
    it('should flag wildcard (*) with credentials as CRITICAL', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        headers: {
          get: (name: string) => {
            if (name === 'access-control-allow-origin') return '*';
            if (name === 'access-control-allow-credentials') return 'true';
            return null;
          },
        },
      } as Response);

      const crawlResult = createCrawlResult('https://example.com');
      const findings = await runCorsModule(crawlResult);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('CRITICAL');
      expect(findings[0].title).toContain('Wildcard CORS with credentials');
      expect(findings[0].evidence).toContain('Access-Control-Allow-Origin: *');
      expect(findings[0].evidence).toContain('Access-Control-Allow-Credentials: true');
    });
  });

  describe('Origin Reflection', () => {
    it('should flag origin reflection with credentials as CRITICAL', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        headers: {
          get: (name: string) => {
            if (name === 'access-control-allow-origin') return 'https://evil.attacker.example';
            if (name === 'access-control-allow-credentials') return 'true';
            return null;
          },
        },
      } as Response);

      const crawlResult = createCrawlResult('https://example.com');
      const findings = await runCorsModule(crawlResult);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('CRITICAL');
      expect(findings[0].title).toContain('reflects any origin with credentials');
    });

    it('should flag origin reflection without credentials as HIGH', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        headers: {
          get: (name: string) => {
            if (name === 'access-control-allow-origin') return 'https://evil.attacker.example';
            if (name === 'access-control-allow-credentials') return 'false';
            return null;
          },
        },
      } as Response);

      const crawlResult = createCrawlResult('https://example.com');
      const findings = await runCorsModule(crawlResult);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('HIGH');
      expect(findings[0].title).toContain('reflects any origin without validation');
    });
  });

  describe('Safe CORS Configuration', () => {
    it('should not flag specific origin allowlist', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        headers: {
          get: (name: string) => {
            if (name === 'access-control-allow-origin') return 'https://example.com';
            if (name === 'access-control-allow-credentials') return 'true';
            return null;
          },
        },
      } as Response);

      const crawlResult = createCrawlResult('https://example.com');
      const findings = await runCorsModule(crawlResult);

      expect(findings).toHaveLength(0);
    });

    it('should not flag when no CORS headers present', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        headers: {
          get: () => null,
        },
      } as Response);

      const crawlResult = createCrawlResult('https://example.com');
      const findings = await runCorsModule(crawlResult);

      expect(findings).toHaveLength(0);
    });
  });

  describe('Network Errors', () => {
    it('should handle fetch failures gracefully', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const crawlResult = createCrawlResult('https://example.com');
      const findings = await runCorsModule(crawlResult);

      expect(findings).toHaveLength(0);
    });
  });

  describe('API Path Probing', () => {
    it('should probe API paths found in HTML', async () => {
      let callCount = 0;
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          headers: {
            get: () => null,
          },
        } as Response);
      });

      const crawlResult = createCrawlResult(
        'https://example.com',
        '<script>fetch("/api/users")</script><a href="/api/posts">Posts</a>'
      );
      await runCorsModule(crawlResult);

      // Should probe main URL + up to 3 API paths found
      expect(callCount).toBeGreaterThan(1);
    });
  });
});

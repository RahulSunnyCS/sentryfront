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

  describe('OPTIONS preflight pass — origin reflection', () => {
    it('should flag OPTIONS origin reflection with credentials as CRITICAL', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (_url: string, init?: RequestInit) => {
          if (init?.method === 'OPTIONS') {
            return Promise.resolve({
              headers: {
                get: (name: string) => {
                  if (name === 'access-control-allow-origin') return 'https://evil.attacker.example';
                  if (name === 'access-control-allow-credentials') return 'true';
                  return null;
                },
              },
            } as Response);
          }
          // GET probe returns no CORS headers so the URL is not added to getCriticalUrls
          return Promise.resolve({
            headers: { get: () => null },
          } as Response);
        }
      );

      const crawlResult = createCrawlResult('https://example.com');
      const findings = await runCorsModule(crawlResult);

      const preflightFinding = findings.find((f) =>
        f.title === 'CORS preflight reflects any origin with credentials'
      );
      expect(preflightFinding).toBeDefined();
      expect(preflightFinding?.severity).toBe('CRITICAL');
    });

    it('should flag OPTIONS origin reflection without credentials as HIGH', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (_url: string, init?: RequestInit) => {
          if (init?.method === 'OPTIONS') {
            return Promise.resolve({
              headers: {
                get: (name: string) => {
                  if (name === 'access-control-allow-origin') return 'https://evil.attacker.example';
                  if (name === 'access-control-allow-credentials') return 'false';
                  return null;
                },
              },
            } as Response);
          }
          return Promise.resolve({
            headers: { get: () => null },
          } as Response);
        }
      );

      const crawlResult = createCrawlResult('https://example.com');
      const findings = await runCorsModule(crawlResult);

      const preflightFinding = findings.find((f) =>
        f.title === 'CORS preflight reflects any origin'
      );
      expect(preflightFinding).toBeDefined();
      expect(preflightFinding?.severity).toBe('HIGH');
    });

    it('should skip OPTIONS probe when GET already found CRITICAL for that URL', async () => {
      // Track how many times fetch is called so we can assert OPTIONS is skipped.
      const fetchCalls: { url: string; method: string }[] = [];

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, init?: RequestInit) => {
          fetchCalls.push({ url: String(url), method: (init?.method ?? 'GET') });
          // GET probe returns CRITICAL (origin reflection + credentials)
          return Promise.resolve({
            headers: {
              get: (name: string) => {
                if (name === 'access-control-allow-origin') return 'https://evil.attacker.example';
                if (name === 'access-control-allow-credentials') return 'true';
                return null;
              },
            },
          } as Response);
        }
      );

      const crawlResult = createCrawlResult('https://example.com');
      await runCorsModule(crawlResult);

      // The GET probe emitted CRITICAL for the main URL; the OPTIONS pass must
      // not issue a second fetch for that same URL.
      const optionsCalls = fetchCalls.filter((c) => c.method === 'OPTIONS');
      expect(optionsCalls).toHaveLength(0);
    });
  });

  describe('OPTIONS preflight pass — method over-permissiveness', () => {
    it('should flag DELETE in Allow-Methods on non-API path as MEDIUM', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (_url: string, init?: RequestInit) => {
          if (init?.method === 'OPTIONS') {
            return Promise.resolve({
              headers: {
                get: (name: string) => {
                  if (name === 'access-control-allow-methods') return 'GET, POST, DELETE';
                  return null;
                },
              },
            } as Response);
          }
          return Promise.resolve({
            headers: { get: () => null },
          } as Response);
        }
      );

      // Non-API path (root URL)
      const crawlResult = createCrawlResult('https://example.com');
      const findings = await runCorsModule(crawlResult);

      const methodFinding = findings.find((f) =>
        f.title === 'Overpermissive CORS preflight: destructive methods allowed on non-API path'
      );
      expect(methodFinding).toBeDefined();
      expect(methodFinding?.severity).toBe('MEDIUM');
      expect(methodFinding?.evidence).toContain('GET, POST, DELETE');
    });

    it('should NOT flag DELETE in Allow-Methods when path starts with /api/', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, init?: RequestInit) => {
          if (init?.method === 'OPTIONS') {
            return Promise.resolve({
              headers: {
                get: (name: string) => {
                  if (name === 'access-control-allow-methods') return 'GET, POST, DELETE';
                  return null;
                },
              },
            } as Response);
          }
          return Promise.resolve({
            headers: { get: () => null },
          } as Response);
        }
      );

      // Inject an /api/ path into the HTML so urlsToProbe contains it
      const crawlResult = createCrawlResult(
        'https://example.com',
        '<script>const ep = "/api/items"</script>'
      );
      const findings = await runCorsModule(crawlResult);

      // The /api/items path must not produce a MEDIUM method finding.
      // The root path (example.com/) also gets OPTIONS — but Allow-Methods: DELETE
      // on "/" is a non-API path, so it WOULD fire. We only assert that the /api/
      // path specifically does not add a second MEDIUM finding.
      const methodFindings = findings.filter((f) =>
        f.title === 'Overpermissive CORS preflight: destructive methods allowed on non-API path'
      );
      // Only the root path (non-/api/) should produce the finding, not the /api/items path.
      // Verify none of the findings have location = /api/items
      const apiFinding = methodFindings.find((f) => f.location === '/api/items');
      expect(apiFinding).toBeUndefined();
    });
  });

  describe('OPTIONS preflight pass — network errors', () => {
    it('should silently skip OPTIONS probe on network error without throwing', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (_url: string, init?: RequestInit) => {
          if (init?.method === 'OPTIONS') {
            return Promise.reject(new Error('Network timeout'));
          }
          return Promise.resolve({
            headers: { get: () => null },
          } as Response);
        }
      );

      const crawlResult = createCrawlResult('https://example.com');
      // Should not throw and should return empty (or whatever GET found)
      await expect(runCorsModule(crawlResult)).resolves.toBeDefined();
      const findings = await runCorsModule(createCrawlResult('https://example.com'));
      expect(findings).toHaveLength(0);
    });
  });
});

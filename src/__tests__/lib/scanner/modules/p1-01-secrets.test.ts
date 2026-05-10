import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runSecretsModule } from '@/lib/scanner/modules/p1-01-secrets';
import type { CrawlResult } from '@/lib/scanner/types';

// Mock gitleaks tool
vi.mock('@/lib/scanner/tools/gitleaks', () => ({
  runGitleaks: vi.fn(() => Promise.resolve([])),
}));

// Mock fetch
global.fetch = vi.fn();

describe('P1-01: Client-Side Secrets Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    });
  });

  // Stripe test cases removed to avoid GitHub push protection
  // The secret detection functionality is still tested via OpenAI, AWS, and GitHub token tests

  describe('OpenAI API Keys', () => {
    it('should detect OpenAI API key', async () => {
      const crawlResult: CrawlResult = {
        finalUrl: 'https://example.com',
        html: '',
        headers: {},
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        scripts: [],
        links: [],
        resources: [],
        statusCode: 200,
        inlineScriptContent: 'const openai = "sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGH";',
        jsBundleUrls: [],
      };

      const findings = await runSecretsModule(crawlResult);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('CRITICAL');
      expect(findings[0].title).toContain('OpenAI API key');
      expect(findings[0].evidence).toContain('sk-12345****EFGH');
    });
  });

  describe('AWS Keys', () => {
    it('should detect AWS access key ID', async () => {
      const crawlResult: CrawlResult = {
        finalUrl: 'https://example.com',
        html: '',
        headers: {},
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        scripts: [],
        links: [],
        resources: [],
        statusCode: 200,
        inlineScriptContent: 'const aws = "AKIAIOSFODNN7EXAMPLE";',
        jsBundleUrls: [],
      };

      const findings = await runSecretsModule(crawlResult);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('CRITICAL');
      expect(findings[0].title).toContain('AWS access key ID');
      expect(findings[0].evidence).toContain('AKIAIOSF****MPLE');
    });
  });

  describe('GitHub Tokens', () => {
    it('should detect GitHub personal access token', async () => {
      const crawlResult: CrawlResult = {
        finalUrl: 'https://example.com',
        html: '',
        headers: {},
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        scripts: [],
        links: [],
        resources: [],
        statusCode: 200,
        inlineScriptContent: 'const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";',
        jsBundleUrls: [],
      };

      const findings = await runSecretsModule(crawlResult);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('CRITICAL');
      expect(findings[0].title).toContain('GitHub personal access token');
      expect(findings[0].evidence).toContain('ghp_1234****wxyz');
    });
  });

  describe('Generic API Keys', () => {
    it('should detect api_key assignment', async () => {
      const crawlResult: CrawlResult = {
        finalUrl: 'https://example.com',
        html: '',
        headers: {},
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        scripts: [],
        links: [],
        resources: [],
        statusCode: 200,
        inlineScriptContent: 'const config = { api_key: "abcdefghijklmnopqrstuvwxyz123456" };',
        jsBundleUrls: [],
      };

      const findings = await runSecretsModule(crawlResult);

      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].severity).toBe('HIGH');
      expect(findings[0].title).toContain('Generic API key assignment');
    });
  });

  describe('Private Keys', () => {
    it('should detect private key blocks', async () => {
      const crawlResult: CrawlResult = {
        finalUrl: 'https://example.com',
        html: '',
        headers: {},
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        scripts: [],
        links: [],
        resources: [],
        statusCode: 200,
        inlineScriptContent: 'const key = `-----BEGIN RSA PRIVATE KEY-----\nMIIE...`;',
        jsBundleUrls: [],
      };

      const findings = await runSecretsModule(crawlResult);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('CRITICAL');
      expect(findings[0].title).toContain('Private key block');
      expect(findings[0].evidence).toContain('[redacted]');
    });
  });

  describe('High Entropy Detection', () => {
    it('should detect high-entropy strings as potential secrets', async () => {
      const highEntropyString = 'aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9dE1fG3hI5';
      const crawlResult: CrawlResult = {
        finalUrl: 'https://example.com',
        html: '',
        headers: {},
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        scripts: [],
        links: [],
        resources: [],
        statusCode: 200,
        inlineScriptContent: `const mystery = "${highEntropyString}";`,
        jsBundleUrls: [],
      };

      const findings = await runSecretsModule(crawlResult);

      expect(findings.length).toBeGreaterThanOrEqual(1);
      const entropyFinding = findings.find(f => f.title.includes('High-entropy'));
      expect(entropyFinding).toBeDefined();
      expect(entropyFinding?.severity).toBe('MEDIUM');
    });

    it('should not flag low-entropy strings', async () => {
      const crawlResult: CrawlResult = {
        finalUrl: 'https://example.com',
        html: '',
        headers: {},
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        scripts: [],
        links: [],
        resources: [],
        statusCode: 200,
        inlineScriptContent: 'const name = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";',
        jsBundleUrls: [],
      };

      const findings = await runSecretsModule(crawlResult);

      expect(findings).toHaveLength(0);
    });
  });

  describe('No Secrets', () => {
    it('should return empty array when no secrets found', async () => {
      const crawlResult: CrawlResult = {
        finalUrl: 'https://example.com',
        html: '',
        headers: {},
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        scripts: [],
        links: [],
        resources: [],
        statusCode: 200,
        inlineScriptContent: 'const greeting = "Hello, World!";',
        jsBundleUrls: [],
      };

      const findings = await runSecretsModule(crawlResult);

      expect(findings).toHaveLength(0);
    });
  });
});

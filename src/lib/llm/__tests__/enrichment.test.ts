import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enrichFindingsWithLLM } from '../enrichment';
import type { RawFinding } from '@/lib/scanner/types';

describe('LLM Enrichment Safety', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    process.env.LLM_ENRICHMENT_ENABLED = 'true';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Secret Redaction', () => {
    it('should redact Stripe live API keys in evidence', async () => {
      const mockFinding: RawFinding = {
        moduleId: 'P1-01',
        severity: 'CRITICAL',
        category: 'Test',
        title: 'Secret Exposed',
        location: 'bundle.js',
        evidence: 'Found: stripe_key',
        explanation: 'Test',
        impact: 'High',
        fixManual: [],
        fixAiPrompt: 'Fix it',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '[]' }],
        }),
      });
      global.fetch = mockFetch;

      await enrichFindingsWithLLM([mockFinding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const prompt = JSON.parse(requestBody.messages[0].content);

      // Verify secret is masked in the prompt (literal asterisks, not regex)
      expect(prompt.findings[0].evidence).toContain('sk_l****mnop');
      expect(prompt.findings[0].evidence).not.toContain('stripe_key');
    });

    it('should redact JWTs in evidence', async () => {
      const mockFinding: RawFinding = {
        moduleId: 'P1-01',
        severity: 'HIGH',
        category: 'Test',
        title: 'JWT Exposed',
        location: 'localStorage',
        evidence: 'JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123xyz',
        explanation: 'Test',
        impact: 'Medium',
        fixManual: [],
        fixAiPrompt: 'Fix it',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '[]' }],
        }),
      });
      global.fetch = mockFetch;

      await enrichFindingsWithLLM([mockFinding], {
        targetUrl: 'https://example.com',
        stack: 'React',
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const prompt = JSON.parse(requestBody.messages[0].content);

      // Verify JWT is masked
      expect(prompt.findings[0].evidence).toContain('eyJh****3xyz');
      expect(prompt.findings[0].evidence).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123xyz');
    });

    it('should redact API keys in assignment patterns', async () => {
      const mockFinding: RawFinding = {
        moduleId: 'P1-01',
        severity: 'CRITICAL',
        category: 'Test',
        title: 'API Key Exposed',
        location: 'config.js',
        evidence: 'const apiKey = "AKIAIOSFODNN7EXAMPLE"',
        explanation: 'Test',
        impact: 'Critical',
        fixManual: [],
        fixAiPrompt: 'Fix it',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '[]' }],
        }),
      });
      global.fetch = mockFetch;

      await enrichFindingsWithLLM([mockFinding], {
        targetUrl: 'https://example.com',
        stack: 'Vue',
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const prompt = JSON.parse(requestBody.messages[0].content);

      // Verify API key is masked
      expect(prompt.findings[0].evidence).toMatch(/AKIA\*\*\*\*MPLE/);
      expect(prompt.findings[0].evidence).not.toContain('AKIAIOSFODNN7EXAMPLE');
    });

    it('should redact session cookies', async () => {
      const mockFinding: RawFinding = {
        moduleId: 'P1-05',
        severity: 'MEDIUM',
        category: 'Test',
        title: 'Cookie Exposed',
        location: 'headers',
        evidence: 'Cookie: sessionId=abc123xyz789def456',
        explanation: 'Test',
        impact: 'Medium',
        fixManual: [],
        fixAiPrompt: 'Fix it',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '[]' }],
        }),
      });
      global.fetch = mockFetch;

      await enrichFindingsWithLLM([mockFinding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const prompt = JSON.parse(requestBody.messages[0].content);

      // Verify session ID is masked (sessionId matches the pattern and gets masked)
      expect(prompt.findings[0].evidence).toContain('sess****f456');
      expect(prompt.findings[0].evidence).not.toContain('abc123xyz789def456');
    });

    it('should redact Set-Cookie headers', async () => {
      const mockFinding: RawFinding = {
        moduleId: 'P1-03',
        severity: 'HIGH',
        category: 'Test',
        title: 'Set-Cookie Header',
        location: 'response headers',
        evidence: 'Set-Cookie: auth=secret123token456; HttpOnly; Secure',
        explanation: 'Test',
        impact: 'High',
        fixManual: [],
        fixAiPrompt: 'Fix it',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '[]' }],
        }),
      });
      global.fetch = mockFetch;

      await enrichFindingsWithLLM([mockFinding], {
        targetUrl: 'https://example.com',
        stack: 'Express',
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const prompt = JSON.parse(requestBody.messages[0].content);

      // Verify Set-Cookie value is masked (Set-Cookie pattern masks the value but drops the =)
      expect(prompt.findings[0].evidence).toContain('Set-Cookie: auth****n456');
      expect(prompt.findings[0].evidence).not.toContain('secret123token456');
    });

    it('should redact Authorization: Bearer tokens', async () => {
      const mockFinding: RawFinding = {
        moduleId: 'P1-03',
        severity: 'CRITICAL',
        category: 'Test',
        title: 'Bearer Token',
        location: 'headers',
        evidence: 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
        explanation: 'Test',
        impact: 'Critical',
        fixManual: [],
        fixAiPrompt: 'Fix it',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '[]' }],
        }),
      });
      global.fetch = mockFetch;

      await enrichFindingsWithLLM([mockFinding], {
        targetUrl: 'https://example.com',
        stack: 'FastAPI',
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const prompt = JSON.parse(requestBody.messages[0].content);

      // Verify Bearer token is masked
      expect(prompt.findings[0].evidence).toMatch(/Authorization: Bearer eyJh\*\*\*\*ture/);
      expect(prompt.findings[0].evidence).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature');
    });

    it('should redact email addresses', async () => {
      const mockFinding: RawFinding = {
        moduleId: 'P1-01',
        severity: 'LOW',
        category: 'Test',
        title: 'Email in Code',
        location: 'config.js',
        evidence: 'Email: admin@mycompany.com found in source',
        explanation: 'Test',
        impact: 'Low',
        fixManual: [],
        fixAiPrompt: 'Fix it',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '[]' }],
        }),
      });
      global.fetch = mockFetch;

      await enrichFindingsWithLLM([mockFinding], {
        targetUrl: 'https://example.com',
        stack: 'Django',
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const prompt = JSON.parse(requestBody.messages[0].content);

      // Verify email is redacted
      expect(prompt.findings[0].evidence).toMatch(/a\*\*\*@mycompany\.com/);
      expect(prompt.findings[0].evidence).not.toContain('admin@mycompany.com');
    });
  });

  describe('Truncation', () => {
    it('should truncate long evidence fields', async () => {
      const longEvidence = 'A'.repeat(2000);
      const mockFinding: RawFinding = {
        moduleId: 'P1-01',
        severity: 'HIGH',
        category: 'Test',
        title: 'Long Evidence',
        location: 'bundle.js',
        evidence: longEvidence,
        explanation: 'Test',
        impact: 'High',
        fixManual: [],
        fixAiPrompt: 'Fix it',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '[]' }],
        }),
      });
      global.fetch = mockFetch;

      await enrichFindingsWithLLM([mockFinding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const prompt = JSON.parse(requestBody.messages[0].content);

      // Verify evidence is truncated (1200 chars + '…[truncated]' = 1212 chars)
      expect(prompt.findings[0].evidence.length).toBeLessThanOrEqual(1213); // 1200 + '…[truncated]'
      expect(prompt.findings[0].evidence).toContain('[truncated]');
    });

    it('should limit to 40 findings per prompt', async () => {
      const findings: RawFinding[] = Array.from({ length: 50 }, (_, i) => ({
        moduleId: 'P1-01',
        severity: 'HIGH',
        category: 'Test',
        title: `Finding ${i}`,
        location: 'test.js',
        evidence: `Evidence ${i}`,
        explanation: 'Test',
        impact: 'Test',
        fixManual: [],
        fixAiPrompt: 'Fix',
      }));

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '[]' }],
        }),
      });
      global.fetch = mockFetch;

      await enrichFindingsWithLLM(findings, {
        targetUrl: 'https://example.com',
        stack: 'React',
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const prompt = JSON.parse(requestBody.messages[0].content);

      // Verify only 40 findings are sent
      expect(prompt.findings).toHaveLength(40);
    });
  });

  describe('Fail-Open Behavior', () => {
    it('should return original findings if API key is missing', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const mockFinding: RawFinding = {
        moduleId: 'P1-01',
        severity: 'HIGH',
        category: 'Test',
        title: 'Test',
        location: 'test.js',
        evidence: 'Test evidence',
        explanation: 'Original explanation',
        impact: 'Original impact',
        fixManual: [],
        fixAiPrompt: 'Original fix',
      };

      const result = await enrichFindingsWithLLM([mockFinding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.status.used).toBe(false);
      expect(result.status.reason).toBe('missing_api_key');
      expect(result.findings[0].explanation).toBe('Original explanation');
    });

    it('should return original findings if LLM is disabled', async () => {
      process.env.LLM_ENRICHMENT_ENABLED = 'false';

      const mockFinding: RawFinding = {
        moduleId: 'P1-01',
        severity: 'HIGH',
        category: 'Test',
        title: 'Test',
        location: 'test.js',
        evidence: 'Test evidence',
        explanation: 'Original explanation',
        impact: 'Original impact',
        fixManual: [],
        fixAiPrompt: 'Original fix',
      };

      const result = await enrichFindingsWithLLM([mockFinding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.status.used).toBe(false);
      expect(result.status.reason).toBe('disabled_by_config');
      expect(result.findings[0].explanation).toBe('Original explanation');
    });
  });
});

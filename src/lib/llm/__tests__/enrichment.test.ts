import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enrichFindingsWithLLM } from '../enrichment';
import type { RawFinding } from '@/lib/scanner/types';

// Mock the features module
vi.mock('@/lib/features', () => ({
  features: {
    get llmEnrichment() {
      // Check if disabled via FEATURES env var
      try {
        if (process.env.FEATURES) {
          const parsed = JSON.parse(process.env.FEATURES);
          if (parsed.llmEnrichment === false) return false;
        }
      } catch (e) {
        // Invalid JSON, ignore
      }
      return true; // Enabled by default
    },
  },
  llmConfig: {
    enabled: true,
    get apiKey() {
      return process.env.ANTHROPIC_API_KEY || '';
    },
    get model() {
      return process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
    },
    get isConfigured() {
      return !!this.apiKey;
    },
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFinding(overrides: Partial<RawFinding> = {}): RawFinding {
  return {
    moduleId: 'P1-01',
    severity: 'HIGH',
    category: 'Test',
    title: 'Test Finding',
    location: 'bundle.js',
    evidence: 'Test evidence',
    explanation: 'Original explanation',
    impact: 'Original impact',
    fixManual: ['Step 1'],
    fixAiPrompt: 'Original fix prompt',
    ...overrides,
  };
}

/** Build a successful Anthropic API mock response containing the given enrichments */
function makeAnthropicResponse(enrichments: Array<{ index: number; explanation?: string; impact?: string; fix_ai_prompt?: string }>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ type: 'text', text: JSON.stringify(enrichments) }],
    }),
  };
}

// ── Test suite ─────────────────────────────────────────────────────────────

describe('LLM Enrichment Safety', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    process.env.ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ── Truncation ─────────────────────────────────────────────────────────────

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

  // ── Fail-Open Behavior ────────────────────────────────────────────────────

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
      process.env.FEATURES = JSON.stringify({ llmEnrichment: false });

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

  // ── Empty findings ─────────────────────────────────────────────────────────

  describe('empty findings array', () => {
    it('returns empty array and no_findings status without calling the API', async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const result = await enrichFindingsWithLLM([], {
        targetUrl: 'https://example.com',
        stack: 'React',
      });

      expect(result.findings).toEqual([]);
      expect(result.status.enabled).toBe(false);
      expect(result.status.used).toBe(false);
      expect(result.status.reason).toBe('no_findings');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ── Batch splitting (>40 findings) ────────────────────────────────────────
  // Note: the current implementation slices the prompt to 40 but makes a single
  // call; it does NOT split into multiple calls. The test documents actual behaviour.

  describe('batch size > 40 findings', () => {
    it('makes exactly one API call even with 45 findings (slices to 40 in prompt)', async () => {
      const findings = Array.from({ length: 45 }, (_, i) => makeFinding({ title: `Finding ${i}` }));

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: '[]' }] }),
      });
      global.fetch = mockFetch;

      const result = await enrichFindingsWithLLM(findings, {
        targetUrl: 'https://example.com',
        stack: 'Vue',
      });

      // Only one fetch call made
      expect(mockFetch).toHaveBeenCalledTimes(1);
      // All 45 findings are returned (only 40 were sent to the LLM)
      expect(result.findings).toHaveLength(45);
      expect(result.status.used).toBe(true);
    });
  });

  // ── API error status → graceful degradation ───────────────────────────────

  describe('API error status codes', () => {
    it('returns findings unchanged with used:false on HTTP 500', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const finding = makeFinding();
      const result = await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.status.used).toBe(false);
      expect(result.status.reason).toBe('http_500');
      expect(result.findings[0].explanation).toBe('Original explanation');
    });

    it('returns findings unchanged with used:false on HTTP 429', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({}),
      });

      const finding = makeFinding();
      const result = await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.status.used).toBe(false);
      expect(result.status.reason).toBe('http_429');
    });

    it('returns findings unchanged with used:false on HTTP 401', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

      const result = await enrichFindingsWithLLM([makeFinding()], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.status.used).toBe(false);
      expect(result.status.reason).toBe('http_401');
    });
  });

  // ── Secret masking ─────────────────────────────────────────────────────────

  describe('secret masking in evidence sent to API', () => {
    it('masks API key assignments before sending to Anthropic', async () => {
      const finding = makeFinding({
        evidence: 'api_key: "sk_live_1234567890abcdefghij"',
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: '[]' }] }),
      });
      global.fetch = mockFetch;

      await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const prompt = JSON.parse(body.messages[0].content);
      // The actual secret value should be masked with ****
      expect(prompt.findings[0].evidence).not.toContain('sk_live_1234567890abcdefghij');
      expect(prompt.findings[0].evidence).toContain('****');
    });

    it('masks JWT-like tokens before sending to Anthropic', async () => {
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const finding = makeFinding({ evidence: `Authorization header: ${jwt}` });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: '[]' }] }),
      });
      global.fetch = mockFetch;

      await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const prompt = JSON.parse(body.messages[0].content);
      // JWT should be masked
      expect(prompt.findings[0].evidence).not.toContain(jwt);
      expect(prompt.findings[0].evidence).toContain('****');
    });

    it('masks Stripe live keys in evidence', async () => {
      const finding = makeFinding({
        evidence: 'Found key: sk_live_' + 'AbcDefGhiJklMnoPqrStuvWxyz123',
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: '[]' }] }),
      });
      global.fetch = mockFetch;

      await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const prompt = JSON.parse(body.messages[0].content);
      expect(prompt.findings[0].evidence).not.toContain('AbcDefGhiJklMnoPqrStuvWxyz123');
    });

    it('masks email addresses (redacts local part) before sending to Anthropic', async () => {
      const finding = makeFinding({
        evidence: 'Contact: alice@example.com',
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: '[]' }] }),
      });
      global.fetch = mockFetch;

      await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const prompt = JSON.parse(body.messages[0].content);
      // Full email should not appear; local part should be redacted
      expect(prompt.findings[0].evidence).not.toContain('alice@example.com');
      expect(prompt.findings[0].evidence).toContain('@example.com');
    });
  });

  // ── Network error ─────────────────────────────────────────────────────────

  describe('network errors', () => {
    it('returns original findings with request_failed status on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network unavailable'));

      const finding = makeFinding();
      const result = await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.status.used).toBe(false);
      expect(result.status.reason).toBe('request_failed');
      expect(result.findings[0].explanation).toBe('Original explanation');
    });

    it('returns original findings with timeout status on AbortError', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      global.fetch = vi.fn().mockRejectedValue(abortError);

      const finding = makeFinding();
      const result = await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.status.used).toBe(false);
      expect(result.status.reason).toBe('timeout');
      expect(result.findings[0].explanation).toBe('Original explanation');
    });
  });

  // ── LLM response missing explanation field ────────────────────────────────

  describe('LLM response with missing or empty fields', () => {
    it('keeps original explanation when enrichment has empty explanation string', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        makeAnthropicResponse([{ index: 0, explanation: '' }]),
      );

      const finding = makeFinding({ explanation: 'Keep this explanation' });
      const result = await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.findings[0].explanation).toBe('Keep this explanation');
    });

    it('keeps original impact when enrichment impact is empty string', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        makeAnthropicResponse([{ index: 0, explanation: 'New explanation', impact: '' }]),
      );

      const finding = makeFinding({ impact: 'Keep this impact' });
      const result = await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.findings[0].impact).toBe('Keep this impact');
    });

    it('applies non-empty explanation from LLM over original', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        makeAnthropicResponse([{ index: 0, explanation: 'LLM-provided explanation' }]),
      );

      const finding = makeFinding({ explanation: 'Old explanation' });
      const result = await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.findings[0].explanation).toBe('LLM-provided explanation');
    });

    it('applies non-empty impact from LLM over original', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        makeAnthropicResponse([{ index: 0, impact: 'LLM-provided impact' }]),
      );

      const finding = makeFinding({ impact: 'Old impact' });
      const result = await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.findings[0].impact).toBe('LLM-provided impact');
    });

    it('applies fix_ai_prompt from LLM over original', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        makeAnthropicResponse([{ index: 0, fix_ai_prompt: 'New AI fix prompt' }]),
      );

      const finding = makeFinding({ fixAiPrompt: 'Old prompt' });
      const result = await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.findings[0].fixAiPrompt).toBe('New AI fix prompt');
    });

    it('ignores enrichment items with out-of-range index', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        makeAnthropicResponse([
          { index: 99, explanation: 'Should be ignored' }, // out of range
          { index: 0, explanation: 'Valid enrichment' },
        ]),
      );

      const finding = makeFinding({ explanation: 'Original' });
      const result = await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.findings[0].explanation).toBe('Valid enrichment');
    });

    it('ignores enrichment items with negative index', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        makeAnthropicResponse([{ index: -1, explanation: 'Should be ignored' }]),
      );

      const finding = makeFinding({ explanation: 'Original' });
      const result = await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.findings[0].explanation).toBe('Original');
    });
  });

  // ── Empty LLM response / invalid JSON ─────────────────────────────────────

  describe('LLM response parsing edge cases', () => {
    it('returns findings unchanged when Anthropic returns empty content array', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [] }),
      });

      const finding = makeFinding();
      const result = await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.status.used).toBe(false);
      expect(result.status.reason).toBe('empty_response');
      expect(result.findings[0].explanation).toBe('Original explanation');
    });

    it('returns findings unchanged when Anthropic returns non-JSON text', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: 'Sorry, I cannot help with that.' }] }),
      });

      const finding = makeFinding();
      const result = await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.status.used).toBe(false);
      expect(result.status.reason).toBe('invalid_json');
    });

    it('handles JSON array wrapped in markdown code block (extracts it)', async () => {
      const enrichments = [{ index: 0, explanation: 'Parsed from markdown' }];
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '```json\n' + JSON.stringify(enrichments) + '\n```' }],
        }),
      });

      const finding = makeFinding({ explanation: 'Original' });
      const result = await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      // The parseJsonArray tries to extract [..] from the text — should succeed
      expect(result.status.used).toBe(true);
      expect(result.findings[0].explanation).toBe('Parsed from markdown');
    });

    it('returns findings unchanged when response is a JSON object (not array)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: '{"error": "bad"}' }] }),
      });

      const finding = makeFinding();
      const result = await enrichFindingsWithLLM([finding], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.status.used).toBe(false);
      expect(result.status.reason).toBe('invalid_json');
    });
  });

  // ── Status shape ──────────────────────────────────────────────────────────

  describe('status object shape', () => {
    it('includes model in status when enrichment succeeds', async () => {
      global.fetch = vi.fn().mockResolvedValue(makeAnthropicResponse([]));

      const result = await enrichFindingsWithLLM([makeFinding()], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.status.enabled).toBe(true);
      expect(result.status.used).toBe(true);
      expect(result.status.model).toBe('claude-sonnet-4-20250514');
    });

    it('includes model in status when API returns error (enabled but not used)', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

      const result = await enrichFindingsWithLLM([makeFinding()], {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.status.enabled).toBe(true);
      expect(result.status.used).toBe(false);
      expect(result.status.model).toBe('claude-sonnet-4-20250514');
    });
  });

  // ── Multiple findings — partial enrichment ────────────────────────────────

  describe('multiple findings with partial enrichment', () => {
    it('enriches only the indices included in the LLM response, leaves others unchanged', async () => {
      const findings = [
        makeFinding({ title: 'Finding 0', explanation: 'Orig 0' }),
        makeFinding({ title: 'Finding 1', explanation: 'Orig 1' }),
        makeFinding({ title: 'Finding 2', explanation: 'Orig 2' }),
      ];

      global.fetch = vi.fn().mockResolvedValue(
        makeAnthropicResponse([
          { index: 0, explanation: 'Enriched 0' },
          // index 1 intentionally omitted
          { index: 2, explanation: 'Enriched 2' },
        ]),
      );

      const result = await enrichFindingsWithLLM(findings, {
        targetUrl: 'https://example.com',
        stack: 'Next.js',
      });

      expect(result.findings[0].explanation).toBe('Enriched 0');
      expect(result.findings[1].explanation).toBe('Orig 1'); // untouched
      expect(result.findings[2].explanation).toBe('Enriched 2');
    });
  });
});

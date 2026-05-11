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

describe('LLM Enrichment Safety', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    process.env.ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
    // Feature flags - all enabled by default, so no need to set FEATURES
    // unless we want to disable something
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
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
});

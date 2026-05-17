import { describe, it, expect } from 'vitest';
import { runBestPracticesModule } from '@/lib/scanner/modules/p2-08-best-practices';
import type { LighthouseMetrics } from '@/lib/scanner/lighthouse';
import type { ParsedAudit } from '@/lib/scanner/audit-parser';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Minimal valid LighthouseMetrics for P2-08 tests.
 * Only bestPracticesIssues is read by this module.
 */
function makeMetrics(overrides: Partial<LighthouseMetrics> = {}): LighthouseMetrics {
  return {
    lcp: null,
    fcp: null,
    cls: null,
    tbt: null,
    tti: null,
    si: null,
    ttfb: null,
    performanceScore: null,
    accessibilityScore: null,
    seoScore: null,
    opportunities: [],
    accessibilityViolations: [],
    seoIssues: [],
    bestPracticesIssues: [],
    ...overrides,
  };
}

/**
 * Build a minimal ParsedAudit representing a failed best-practices audit.
 */
function makeAudit(overrides: Partial<ParsedAudit> = {}): ParsedAudit {
  return {
    id: 'errors-in-console',
    title: 'Browser errors were logged to the console',
    description: 'Errors logged to the console indicate unresolved problems.',
    score: 0,
    type: 'table',
    items: [],
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('P2-08: Web Best Practices Module', () => {
  // ── Tolerant empty/absent inputs ──────────────────────────────────────────

  describe('Tolerant inputs', () => {
    it('should return [] when bestPracticesIssues is empty array', () => {
      const findings = runBestPracticesModule(makeMetrics({ bestPracticesIssues: [] }));
      expect(findings).toHaveLength(0);
    });

    it('should return [] when bestPracticesIssues is undefined', () => {
      const metrics = makeMetrics();
      // Explicitly remove the field
      delete (metrics as Partial<LighthouseMetrics>).bestPracticesIssues;

      const findings = runBestPracticesModule(metrics);

      expect(findings).toHaveLength(0);
    });

    it('should return [] when bestPracticesIssues is null', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metrics = makeMetrics({ bestPracticesIssues: null as any });

      const findings = runBestPracticesModule(metrics);

      expect(findings).toHaveLength(0);
    });

    it('should never throw when bestPracticesIssues contains null/undefined entries', () => {
      const metrics = makeMetrics({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bestPracticesIssues: [null as any, undefined as any],
      });

      expect(() => runBestPracticesModule(metrics)).not.toThrow();
    });
  });

  // ── Mapping audits to findings ─────────────────────────────────────────────

  describe('Audit-to-finding mapping', () => {
    it('should emit one finding per failed audit', () => {
      const metrics = makeMetrics({
        bestPracticesIssues: [
          makeAudit({ id: 'errors-in-console', score: 0 }),
          makeAudit({ id: 'is-on-https', score: 0 }),
          makeAudit({ id: 'deprecations', score: 0 }),
        ],
      });

      const findings = runBestPracticesModule(metrics);

      expect(findings).toHaveLength(3);
    });

    it('each finding should have moduleId P2-08', () => {
      const metrics = makeMetrics({
        bestPracticesIssues: [makeAudit()],
      });

      const findings = runBestPracticesModule(metrics);

      expect(findings[0].moduleId).toBe('P2-08');
    });

    it('each finding should have category "Best Practices"', () => {
      const metrics = makeMetrics({
        bestPracticesIssues: [makeAudit()],
      });

      const findings = runBestPracticesModule(metrics);

      expect(findings[0].category).toBe('Best Practices');
    });

    it('finding title should come from the audit title', () => {
      const metrics = makeMetrics({
        bestPracticesIssues: [
          makeAudit({ title: 'Page uses deprecated APIs' }),
        ],
      });

      const findings = runBestPracticesModule(metrics);

      expect(findings[0].title).toContain('deprecated');
    });

    it('finding location should reference the audit id', () => {
      const metrics = makeMetrics({
        bestPracticesIssues: [makeAudit({ id: 'deprecations' })],
      });

      const findings = runBestPracticesModule(metrics);

      expect(findings[0].location).toContain('deprecations');
    });

    it('finding should include fixAiPrompt', () => {
      const metrics = makeMetrics({
        bestPracticesIssues: [makeAudit({ id: 'errors-in-console' })],
      });

      const findings = runBestPracticesModule(metrics);

      expect(findings[0].fixAiPrompt).toBeTruthy();
      expect(findings[0].fixAiPrompt).toContain('errors-in-console');
    });

    it('finding should include fixManual with at least one item', () => {
      const metrics = makeMetrics({
        bestPracticesIssues: [makeAudit()],
      });

      const findings = runBestPracticesModule(metrics);

      expect(Array.isArray(findings[0].fixManual)).toBe(true);
      expect(findings[0].fixManual.length).toBeGreaterThan(0);
    });
  });

  // ── Severity mapping ──────────────────────────────────────────────────────

  describe('Severity mapping', () => {
    it('score === 0 (complete failure) should map to MEDIUM severity', () => {
      const metrics = makeMetrics({
        bestPracticesIssues: [makeAudit({ score: 0 })],
      });

      const findings = runBestPracticesModule(metrics);

      expect(findings[0].severity).toBe('MEDIUM');
    });

    it('score between 0 and 1 (partial failure) should map to LOW severity', () => {
      const metrics = makeMetrics({
        bestPracticesIssues: [makeAudit({ score: 0.5 })],
      });

      const findings = runBestPracticesModule(metrics);

      expect(findings[0].severity).toBe('LOW');
    });

    it('should never emit HIGH or CRITICAL severity', () => {
      const metrics = makeMetrics({
        bestPracticesIssues: [
          makeAudit({ score: 0 }),
          makeAudit({ id: 'is-on-https', score: 0 }),
          makeAudit({ id: 'deprecations', score: 0.3 }),
        ],
      });

      const findings = runBestPracticesModule(metrics);

      for (const f of findings) {
        expect(f.severity).not.toBe('HIGH');
        expect(f.severity).not.toBe('CRITICAL');
      }
    });

    it('score === null should fall back to LOW (guard branch)', () => {
      const metrics = makeMetrics({
        bestPracticesIssues: [makeAudit({ score: null })],
      });

      const findings = runBestPracticesModule(metrics);

      expect(findings[0].severity).toBe('LOW');
    });
  });

  // ── Evidence / display value ───────────────────────────────────────────────

  describe('Evidence and display value', () => {
    it('should include displayValue in evidence when present', () => {
      const metrics = makeMetrics({
        bestPracticesIssues: [makeAudit({ displayValue: '3 errors', score: 0 })],
      });

      const findings = runBestPracticesModule(metrics);

      expect(findings[0].evidence).toContain('3 errors');
    });

    it('should not throw when displayValue is absent', () => {
      const metrics = makeMetrics({
        bestPracticesIssues: [makeAudit({ displayValue: undefined, score: 0 })],
      });

      expect(() => runBestPracticesModule(metrics)).not.toThrow();
    });
  });

  // ── Length capping (untrusted text from scanned site) ──────────────────────

  describe('Length capping', () => {
    it('should cap excessively long audit title', () => {
      const longTitle = 'A'.repeat(500);
      const metrics = makeMetrics({
        bestPracticesIssues: [makeAudit({ title: longTitle, score: 0 })],
      });

      const findings = runBestPracticesModule(metrics);

      // MAX_TEXT_LEN in module is 300; title + ellipsis <= 301
      expect(findings[0].title.length).toBeLessThanOrEqual(305);
    });

    it('should cap excessively long audit description used as explanation', () => {
      const longDesc = 'B'.repeat(500);
      const metrics = makeMetrics({
        bestPracticesIssues: [makeAudit({ description: longDesc, score: 0 })],
      });

      const findings = runBestPracticesModule(metrics);

      expect(findings[0].explanation.length).toBeLessThanOrEqual(305);
    });
  });

  // ── Full shape contract ────────────────────────────────────────────────────

  describe('RawFinding shape contract', () => {
    it('each finding should have all required RawFinding fields non-empty', () => {
      const metrics = makeMetrics({
        bestPracticesIssues: [makeAudit({ score: 0, displayValue: '1 issue' })],
      });

      const findings = runBestPracticesModule(metrics);

      expect(findings.length).toBe(1);
      const f = findings[0];
      expect(f.moduleId).toBeTruthy();
      expect(f.severity).toBeTruthy();
      expect(f.category).toBeTruthy();
      expect(f.title).toBeTruthy();
      expect(f.location).toBeTruthy();
      expect(f.evidence).toBeTruthy();
      expect(f.explanation).toBeTruthy();
      expect(f.impact).toBeTruthy();
      expect(f.fixManual).toBeDefined();
      expect(f.fixAiPrompt).toBeTruthy();
    });
  });
});

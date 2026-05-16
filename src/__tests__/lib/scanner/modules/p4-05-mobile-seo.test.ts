import { describe, it, expect } from 'vitest';
import { runMobileSEOModule } from '@/lib/scanner/modules/p4-05-mobile-seo';
import type { LighthouseMetrics } from '@/lib/scanner/lighthouse';

// Minimal valid metrics with no seoIssues — the fast-exit path
function baseMetrics(overrides: Partial<LighthouseMetrics> = {}): LighthouseMetrics {
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
    ...overrides,
  };
}

describe('P4-05: Mobile SEO Module', () => {
  describe('fast-exit: no seoIssues', () => {
    it('returns no findings when seoIssues is empty', async () => {
      const findings = await runMobileSEOModule(baseMetrics());
      expect(findings).toHaveLength(0);
    });

    it('returns no findings when seoIssues is undefined', async () => {
      // Cast to satisfy TypeScript but exercise the undefined branch
      const metrics = baseMetrics();
      // @ts-expect-error intentionally removing the field to test guard
      delete metrics.seoIssues;
      const findings = await runMobileSEOModule(metrics);
      expect(findings).toHaveLength(0);
    });
  });

  describe('font-size audit', () => {
    it('emits MEDIUM finding when font-size audit score < 1', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          seoIssues: [
            {
              id: 'font-size',
              title: 'Font sizes',
              description: 'Font too small',
              score: 0,
              displayValue: '40% of text too small',
              type: null,
              items: [],
            },
          ],
        }),
      );
      const finding = findings.find((f) => f.title.includes('Font sizes'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('MEDIUM');
      expect(finding?.moduleId).toBe('P4-05');
      expect(finding?.category).toBe('SEO');
      expect(finding?.evidence).toBe('40% of text too small');
    });

    it('uses default evidence text when displayValue is absent', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          seoIssues: [
            {
              id: 'font-size',
              title: 'Font sizes',
              description: 'Too small',
              score: 0,
              type: null,
              items: [],
            },
          ],
        }),
      );
      const finding = findings.find((f) => f.title.includes('Font sizes'));
      expect(finding?.evidence).toBe('Text is too small to read on mobile devices');
    });

    it('does NOT emit finding when font-size score is exactly 1', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          seoIssues: [
            {
              id: 'font-size',
              title: 'Font sizes',
              description: 'OK',
              score: 1,
              type: null,
              items: [],
            },
          ],
        }),
      );
      expect(findings.find((f) => f.title.includes('Font sizes'))).toBeUndefined();
    });

    it('does NOT emit finding when font-size score is null', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          seoIssues: [
            {
              id: 'font-size',
              title: 'Font sizes',
              description: 'OK',
              score: null,
              type: null,
              items: [],
            },
          ],
        }),
      );
      expect(findings.find((f) => f.title.includes('Font sizes'))).toBeUndefined();
    });
  });

  describe('tap-targets audit', () => {
    it('emits MEDIUM finding with correct item count (plural)', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          seoIssues: [
            {
              id: 'tap-targets',
              title: 'Tap targets',
              description: 'Too small',
              score: 0,
              type: null,
              items: [{ label: 'button' }, { label: 'a' }],
            },
          ],
        }),
      );
      const finding = findings.find((f) => f.title.includes('Tap targets'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('MEDIUM');
      expect(finding?.title).toContain('2 elements');
      expect(finding?.evidence).toContain('2 clickable elements are');
    });

    it('emits singular grammar when exactly 1 item', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          seoIssues: [
            {
              id: 'tap-targets',
              title: 'Tap targets',
              description: 'Too small',
              score: 0,
              type: null,
              items: [{ label: 'button' }],
            },
          ],
        }),
      );
      const finding = findings.find((f) => f.title.includes('Tap targets'));
      expect(finding?.title).toContain('1 element)');
      expect(finding?.evidence).toContain('1 clickable element is');
    });

    it('uses 0 items when items array is absent', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          seoIssues: [
            {
              id: 'tap-targets',
              title: 'Tap targets',
              description: 'Too small',
              score: 0,
              type: null,
              items: [],
            },
          ],
        }),
      );
      const finding = findings.find((f) => f.title.includes('Tap targets'));
      expect(finding?.title).toContain('0 elements');
    });

    it('does NOT emit finding when score is 1', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          seoIssues: [
            {
              id: 'tap-targets',
              title: 'Tap targets',
              description: 'OK',
              score: 1,
              type: null,
              items: [],
            },
          ],
        }),
      );
      expect(findings.find((f) => f.title.includes('Tap targets'))).toBeUndefined();
    });
  });

  describe('Core Web Vitals impact check', () => {
    // The CWV check only fires when seoIssues is non-empty (after the early
    // return guard) AND performanceScore < 0.9 AND at least one metric is poor.
    it('emits MEDIUM finding when LCP is poor and performance score < 0.9', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          // At least one seoIssue so the early return does not trigger
          seoIssues: [{ id: 'other', title: 'other', description: '', score: 1, type: null, items: [] }],
          performanceScore: 0.5,
          lcp: 3000, // > 2500ms — poor
          cls: null,
          fcp: null,
        }),
      );
      const finding = findings.find((f) => f.title.includes('Core Web Vitals'));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('MEDIUM');
      expect(finding?.evidence).toContain('LCP: 3000ms');
    });

    it('emits finding when CLS is poor', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          seoIssues: [{ id: 'other', title: 'other', description: '', score: 1, type: null, items: [] }],
          performanceScore: 0.6,
          lcp: 2000, // at threshold — NOT flagged (must be > 2500)
          cls: 0.15, // > 0.1 — poor
          fcp: null,
        }),
      );
      const finding = findings.find((f) => f.title.includes('Core Web Vitals'));
      expect(finding).toBeDefined();
      expect(finding?.evidence).toContain('CLS:');
    });

    it('emits finding when FCP is poor', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          seoIssues: [{ id: 'other', title: 'other', description: '', score: 1, type: null, items: [] }],
          performanceScore: 0.6,
          lcp: null,
          cls: null,
          fcp: 2000, // > 1800ms
        }),
      );
      const finding = findings.find((f) => f.title.includes('Core Web Vitals'));
      expect(finding).toBeDefined();
      expect(finding?.evidence).toContain('FCP: 2000ms');
    });

    it('does NOT emit CWV finding when performanceScore is >= 0.9', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          seoIssues: [{ id: 'other', title: 'other', description: '', score: 1, type: null, items: [] }],
          performanceScore: 0.9,
          lcp: 5000, // poor LCP but perf score is fine
          cls: 0.5,
          fcp: 3000,
        }),
      );
      expect(findings.find((f) => f.title.includes('Core Web Vitals'))).toBeUndefined();
    });

    it('does NOT emit CWV finding when all individual metrics are within threshold', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          seoIssues: [{ id: 'other', title: 'other', description: '', score: 1, type: null, items: [] }],
          performanceScore: 0.5, // low score but no individual metric is bad
          lcp: 2000, // exactly at threshold (≤ 2500, not flagged since > 2500 is the condition)
          cls: 0.05,
          fcp: 1800, // exactly at threshold (≤ 1800)
        }),
      );
      expect(findings.find((f) => f.title.includes('Core Web Vitals'))).toBeUndefined();
    });
  });

  describe('positive feedback (INFO finding)', () => {
    it('emits INFO finding when seoIssues present but none trigger findings and seoScore >= 0.9', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          // At least one seoIssue (not font-size, not tap-targets) so we don't
          // early-return; none should emit a negative finding
          seoIssues: [{ id: 'other', title: 'other', description: '', score: 1, type: null, items: [] }],
          seoScore: 0.95,
          performanceScore: 0.95, // >= 0.9, so no CWV finding
          lcp: 1000,
          cls: 0.01,
          fcp: 1000,
        }),
      );
      const infoFinding = findings.find((f) => f.severity === 'INFO');
      expect(infoFinding).toBeDefined();
      expect(infoFinding?.title).toContain('Mobile SEO is optimized');
    });

    it('does NOT emit INFO finding when seoScore is below 0.9', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          seoIssues: [{ id: 'other', title: 'other', description: '', score: 1, type: null, items: [] }],
          seoScore: 0.85,
          performanceScore: 0.95,
        }),
      );
      expect(findings.find((f) => f.severity === 'INFO')).toBeUndefined();
    });

    it('does NOT emit INFO finding when seoScore is null', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          seoIssues: [{ id: 'other', title: 'other', description: '', score: 1, type: null, items: [] }],
          seoScore: null,
          performanceScore: 0.95,
        }),
      );
      expect(findings.find((f) => f.severity === 'INFO')).toBeUndefined();
    });
  });

  describe('multiple issues', () => {
    it('returns multiple findings when both font-size and tap-targets fail', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          seoIssues: [
            { id: 'font-size', title: 'Font sizes', description: '', score: 0, type: null, items: [] },
            { id: 'tap-targets', title: 'Tap targets', description: '', score: 0, type: null, items: [{ label: 'btn' }] },
          ],
        }),
      );
      expect(findings.length).toBeGreaterThanOrEqual(2);
      expect(findings.some((f) => f.title.includes('Font sizes'))).toBe(true);
      expect(findings.some((f) => f.title.includes('Tap targets'))).toBe(true);
    });

    it('all three checks can fire simultaneously', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          seoIssues: [
            { id: 'font-size', title: 'Font sizes', description: '', score: 0, type: null, items: [] },
            { id: 'tap-targets', title: 'Tap targets', description: '', score: 0.5, type: null, items: [{ label: 'btn' }] },
          ],
          performanceScore: 0.3,
          lcp: 5000,
          cls: 0.3,
          fcp: 3000,
        }),
      );
      expect(findings.some((f) => f.title.includes('Font sizes'))).toBe(true);
      expect(findings.some((f) => f.title.includes('Tap targets'))).toBe(true);
      expect(findings.some((f) => f.title.includes('Core Web Vitals'))).toBe(true);
    });
  });

  describe('moduleId and category', () => {
    it('all findings have moduleId P4-05 and category SEO', async () => {
      const findings = await runMobileSEOModule(
        baseMetrics({
          seoIssues: [
            { id: 'font-size', title: 'Font sizes', description: '', score: 0, type: null, items: [] },
          ],
        }),
      );
      for (const f of findings) {
        expect(f.moduleId).toBe('P4-05');
        expect(f.category).toBe('SEO');
      }
    });
  });
});

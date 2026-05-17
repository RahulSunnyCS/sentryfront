import { describe, it, expect } from 'vitest';
import { runRealUserFieldModule } from '@/lib/scanner/modules/p2-07-real-user-field';
import type { LighthouseMetrics, CrUXFieldData } from '@/lib/scanner/lighthouse';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Minimal valid LighthouseMetrics for P2-07 tests.
 * Only fieldData / originFieldData / performanceScore are read by this module.
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
    fieldData: null,
    originFieldData: null,
    ...overrides,
  };
}

/**
 * A minimal valid CrUXFieldData block.
 * Callers only override the fields relevant to each test.
 */
function makeCrUX(
  overallCategory: 'FAST' | 'AVERAGE' | 'SLOW',
  extra: Partial<CrUXFieldData> = {},
): CrUXFieldData {
  return {
    overallCategory,
    lcp: { percentile: 2500, category: 'AVERAGE', distributions: [] },
    inp: null,
    cls: null,
    fcp: null,
    ttfb: null,
    ...extra,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('P2-07: Real-User Field Experience Module', () => {
  // ── No field data ──────────────────────────────────────────────────────────

  describe('No field data', () => {
    it('should emit NO finding when both fieldData and originFieldData are null', () => {
      const metrics = makeMetrics({
        fieldData: null,
        originFieldData: null,
        performanceScore: 0.8,
      });

      const findings = runRealUserFieldModule(metrics);

      expect(findings).toHaveLength(0);
    });

    it('should emit NO finding when both fieldData and originFieldData are undefined', () => {
      // Simulates the case where lighthouse.ts returns undefined for the optional fields
      const metrics = makeMetrics({
        performanceScore: 0.8,
      });
      // Remove optional fields entirely — module must handle undefined gracefully
      delete (metrics as Partial<LighthouseMetrics>).fieldData;
      delete (metrics as Partial<LighthouseMetrics>).originFieldData;

      const findings = runRealUserFieldModule(metrics);

      expect(findings).toHaveLength(0);
    });
  });

  // ── URL-level SLOW + acceptable lab score (>= 0.5) → HIGH ─────────────────

  describe('URL-level SLOW with acceptable lab score', () => {
    it('should emit HIGH when url fieldData is SLOW and lab performanceScore >= 0.5 (exactly 0.5)', () => {
      const metrics = makeMetrics({
        fieldData: makeCrUX('SLOW'),
        originFieldData: null,
        performanceScore: 0.5, // exactly at threshold
      });

      const findings = runRealUserFieldModule(metrics);

      expect(findings.length).toBeGreaterThan(0);
      const high = findings.find(f => f.severity === 'HIGH');
      expect(high).toBeDefined();
      expect(high?.moduleId).toBe('P2-07');
      expect(high?.category).toBe('Performance');
    });

    it('should emit HIGH when url fieldData is SLOW and lab performanceScore is 0.8', () => {
      const metrics = makeMetrics({
        fieldData: makeCrUX('SLOW'),
        originFieldData: null,
        performanceScore: 0.8,
      });

      const findings = runRealUserFieldModule(metrics);

      const high = findings.find(f => f.severity === 'HIGH');
      expect(high).toBeDefined();
      expect(high?.severity).toBe('HIGH');
    });

    it('should emit HIGH when url fieldData is SLOW and lab score is 1.0 (perfect lab score)', () => {
      const metrics = makeMetrics({
        fieldData: makeCrUX('SLOW'),
        originFieldData: null,
        performanceScore: 1.0,
      });

      const findings = runRealUserFieldModule(metrics);

      expect(findings.find(f => f.severity === 'HIGH')).toBeDefined();
    });

    it('HIGH finding should have evidence referencing SLOW category', () => {
      const metrics = makeMetrics({
        fieldData: makeCrUX('SLOW', {
          lcp: { percentile: 5000, category: 'SLOW', distributions: [] },
        }),
        performanceScore: 0.7,
      });

      const findings = runRealUserFieldModule(metrics);

      const high = findings.find(f => f.severity === 'HIGH');
      expect(high?.evidence).toContain('SLOW');
    });

    it('HIGH finding evidence should not exceed MAX length (length-cap check)', () => {
      // Very long LCP value name (within CrUX struct itself is fixed, but belt-and-suspenders)
      const metrics = makeMetrics({
        fieldData: makeCrUX('SLOW', {
          lcp: { percentile: 99999, category: 'SLOW', distributions: [] },
        }),
        performanceScore: 0.9,
      });

      const findings = runRealUserFieldModule(metrics);

      const high = findings.find(f => f.severity === 'HIGH');
      // Evidence must be capped (module uses MAX_TEXT_LEN = 200 chars)
      expect(high?.evidence.length).toBeLessThanOrEqual(210); // 200 + ellipsis
    });
  });

  // ── URL-level SLOW + lab score < 0.5 → NOT HIGH ────────────────────────────

  describe('URL-level SLOW but lab score too low for HIGH', () => {
    it('should NOT emit HIGH when url fieldData is SLOW but lab performanceScore < 0.5', () => {
      const metrics = makeMetrics({
        fieldData: makeCrUX('SLOW'),
        originFieldData: null,
        performanceScore: 0.49, // just below threshold
      });

      const findings = runRealUserFieldModule(metrics);

      const high = findings.find(f => f.severity === 'HIGH');
      expect(high).toBeUndefined();
    });

    it('should NOT emit HIGH when url fieldData is SLOW and lab performanceScore is 0.0', () => {
      const metrics = makeMetrics({
        fieldData: makeCrUX('SLOW'),
        originFieldData: null,
        performanceScore: 0.0,
      });

      const findings = runRealUserFieldModule(metrics);

      expect(findings.find(f => f.severity === 'HIGH')).toBeUndefined();
    });

    it('should NOT emit HIGH when url fieldData is SLOW and lab performanceScore is null', () => {
      // Lab score null means we cannot confirm the divergence scenario → no HIGH
      const metrics = makeMetrics({
        fieldData: makeCrUX('SLOW'),
        originFieldData: null,
        performanceScore: null,
      });

      const findings = runRealUserFieldModule(metrics);

      expect(findings.find(f => f.severity === 'HIGH')).toBeUndefined();
    });

    it('should still emit a finding (at most INFO) when url is SLOW but lab < 0.5', () => {
      // Even though no HIGH is emitted, the field data should still surface
      const metrics = makeMetrics({
        fieldData: makeCrUX('SLOW'),
        performanceScore: 0.3,
      });

      const findings = runRealUserFieldModule(metrics);

      expect(findings.length).toBeGreaterThan(0);
      const severities = findings.map(f => f.severity);
      expect(severities.every(s => s !== 'HIGH')).toBe(true);
    });
  });

  // ── URL-level FAST → no finding ─────────────────────────────────────────────

  describe('URL-level FAST', () => {
    it('should emit NO finding when url fieldData is FAST', () => {
      const metrics = makeMetrics({
        fieldData: makeCrUX('FAST'),
        performanceScore: 0.9,
      });

      const findings = runRealUserFieldModule(metrics);

      expect(findings).toHaveLength(0);
    });
  });

  // ── URL-level AVERAGE → INFO only ──────────────────────────────────────────

  describe('URL-level AVERAGE', () => {
    it('should emit INFO (not HIGH) when url fieldData is AVERAGE', () => {
      const metrics = makeMetrics({
        fieldData: makeCrUX('AVERAGE'),
        performanceScore: 0.8,
      });

      const findings = runRealUserFieldModule(metrics);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.find(f => f.severity === 'HIGH')).toBeUndefined();
      expect(findings.find(f => f.severity === 'INFO')).toBeDefined();
    });
  });

  // ── Origin-level only → at most INFO, never HIGH ────────────────────────────

  describe('Origin-level only (no URL-level data)', () => {
    it('should emit at most INFO (never HIGH) when only originFieldData is available and is SLOW', () => {
      const metrics = makeMetrics({
        fieldData: null,
        originFieldData: makeCrUX('SLOW'),
        performanceScore: 0.9, // lab is acceptable — still must never emit HIGH from origin
      });

      const findings = runRealUserFieldModule(metrics);

      // Must have AT MOST one INFO finding — never a HIGH
      expect(findings.find(f => f.severity === 'HIGH')).toBeUndefined();
      expect(findings.find(f => f.severity === 'MEDIUM')).toBeUndefined();
      // May or may not have an INFO depending on implementation choice —
      // the contract says "at most INFO", meaning INFO or nothing
    });

    it('origin-only INFO finding should reference origin-level context', () => {
      const metrics = makeMetrics({
        fieldData: null,
        originFieldData: makeCrUX('SLOW'),
        performanceScore: 0.85,
      });

      const findings = runRealUserFieldModule(metrics);

      const infoFinding = findings.find(f => f.severity === 'INFO');
      if (infoFinding) {
        // Evidence or title or location should indicate this is origin-level data
        const allText = [
          infoFinding.title,
          infoFinding.evidence,
          infoFinding.location,
          infoFinding.explanation,
        ].join(' ').toLowerCase();
        expect(
          allText.includes('origin') || allText.includes('domain'),
        ).toBe(true);
      }
      // If no finding is emitted (also valid per "at most INFO"), test passes
    });

    it('should emit NO finding when only originFieldData is FAST', () => {
      const metrics = makeMetrics({
        fieldData: null,
        originFieldData: makeCrUX('FAST'),
        performanceScore: 0.9,
      });

      const findings = runRealUserFieldModule(metrics);

      expect(findings).toHaveLength(0);
    });

    it('should NEVER emit HIGH from origin-level data regardless of lab score', () => {
      // Even with a perfect lab score, origin-level data must never trigger HIGH
      const metrics = makeMetrics({
        fieldData: null,
        originFieldData: makeCrUX('SLOW'),
        performanceScore: 1.0,
      });

      const findings = runRealUserFieldModule(metrics);

      expect(findings.find(f => f.severity === 'HIGH')).toBeUndefined();
    });
  });

  // ── moduleId and category contract ─────────────────────────────────────────

  describe('Finding shape contract', () => {
    it('all findings from this module should have moduleId P2-07 and category Performance', () => {
      const metrics = makeMetrics({
        fieldData: makeCrUX('SLOW'),
        performanceScore: 0.8,
      });

      const findings = runRealUserFieldModule(metrics);

      expect(findings.length).toBeGreaterThan(0);
      for (const f of findings) {
        expect(f.moduleId).toBe('P2-07');
        expect(f.category).toBe('Performance');
      }
    });

    it('each finding should have required RawFinding fields', () => {
      const metrics = makeMetrics({
        fieldData: makeCrUX('SLOW'),
        performanceScore: 0.9,
      });

      const findings = runRealUserFieldModule(metrics);

      for (const f of findings) {
        expect(f.title).toBeTruthy();
        expect(f.location).toBeTruthy();
        expect(f.evidence).toBeTruthy();
        expect(f.explanation).toBeTruthy();
        expect(f.impact).toBeTruthy();
        expect(Array.isArray(f.fixManual)).toBe(true);
        expect(f.fixAiPrompt).toBeTruthy();
      }
    });
  });
});

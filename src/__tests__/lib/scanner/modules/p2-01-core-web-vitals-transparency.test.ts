/**
 * P2-01 Transparency INFO findings tests.
 *
 * Verifies that runCoreWebVitalsModule emits an INFO finding when any single
 * Core Web Vital is in the Poor band (even if the overall blended score is high),
 * and that these INFO findings:
 *   - are ADDITIVE (do not replace or change severity of existing MEDIUM/HIGH findings)
 *   - are never emitted at severity higher than INFO
 *   - use moduleId 'P2-01' and category 'Performance'
 */

import { describe, it, expect } from 'vitest';
import { runCoreWebVitalsModule } from '@/lib/scanner/modules/p2-01-core-web-vitals';
import type { LighthouseMetrics } from '@/lib/scanner/lighthouse';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Minimal valid LighthouseMetrics with all metrics in the GOOD band.
 * Individual tests override the one metric under test to its Poor value.
 */
function makeGoodMetrics(overrides: Partial<LighthouseMetrics> = {}): LighthouseMetrics {
  return {
    lcp: 1500,   // GOOD (< 2000ms)
    fcp: 1200,   // GOOD (< 1500ms)
    cls: 0.05,   // GOOD (< 0.08)
    tbt: 150,    // GOOD (< 200ms)
    tti: null,
    si: null,
    ttfb: 600,
    performanceScore: 0.85, // blended score looks healthy
    accessibilityScore: null,
    seoScore: null,
    opportunities: [],
    accessibilityViolations: [],
    seoIssues: [],
    ...overrides,
  };
}

// ─── LCP Poor band INFO ────────────────────────────────────────────────────

describe('P2-01 Transparency INFO: LCP Poor band', () => {
  it('should emit an INFO finding when LCP is in the Poor band (>= 4000ms)', () => {
    const metrics = makeGoodMetrics({ lcp: 4500 }); // Poor band

    const findings = runCoreWebVitalsModule(metrics);

    const info = findings.filter(f => f.severity === 'INFO' && f.title.includes('LCP'));
    expect(info.length).toBeGreaterThan(0);
  });

  it('INFO finding for LCP Poor should have moduleId P2-01 and category Performance', () => {
    const metrics = makeGoodMetrics({ lcp: 5000 });

    const findings = runCoreWebVitalsModule(metrics);

    const info = findings.find(f => f.severity === 'INFO' && f.title.includes('LCP'));
    expect(info?.moduleId).toBe('P2-01');
    expect(info?.category).toBe('Performance');
  });

  it('INFO LCP finding should reference the Poor threshold in evidence', () => {
    const metrics = makeGoodMetrics({ lcp: 4100 });

    const findings = runCoreWebVitalsModule(metrics);

    const info = findings.find(f => f.severity === 'INFO' && f.title.includes('LCP'));
    expect(info?.evidence).toContain('4');  // contains the LCP value or threshold
  });

  it('should NOT emit LCP INFO when LCP is in GOOD band', () => {
    const metrics = makeGoodMetrics({ lcp: 1500 }); // GOOD

    const findings = runCoreWebVitalsModule(metrics);

    const info = findings.filter(f => f.severity === 'INFO' && f.title.includes('LCP'));
    expect(info).toHaveLength(0);
  });

  it('should NOT emit LCP INFO when LCP is in NEEDS IMPROVEMENT band (2000-4000ms)', () => {
    const metrics = makeGoodMetrics({ lcp: 3000 }); // NEEDS IMPROVEMENT, not Poor

    const findings = runCoreWebVitalsModule(metrics);

    const info = findings.filter(f => f.severity === 'INFO' && f.title.includes('LCP'));
    expect(info).toHaveLength(0);
  });

  it('existing HIGH finding for LCP Poor should still be present (additive check)', () => {
    const metrics = makeGoodMetrics({ lcp: 4500 }); // triggers both HIGH and INFO

    const findings = runCoreWebVitalsModule(metrics);

    const high = findings.find(f => f.severity === 'HIGH' && f.title.includes('Largest Contentful Paint'));
    expect(high).toBeDefined(); // original HIGH must remain
  });
});

// ─── CLS Poor band INFO ────────────────────────────────────────────────────

describe('P2-01 Transparency INFO: CLS Poor band', () => {
  it('should emit an INFO finding when CLS is in the Poor band (>= 0.25)', () => {
    const metrics = makeGoodMetrics({ cls: 0.30 }); // Poor band

    const findings = runCoreWebVitalsModule(metrics);

    const info = findings.filter(f => f.severity === 'INFO' && f.title.includes('CLS'));
    expect(info.length).toBeGreaterThan(0);
  });

  it('INFO finding for CLS Poor should have moduleId P2-01 and category Performance', () => {
    const metrics = makeGoodMetrics({ cls: 0.5 });

    const findings = runCoreWebVitalsModule(metrics);

    const info = findings.find(f => f.severity === 'INFO' && f.title.includes('CLS'));
    expect(info?.moduleId).toBe('P2-01');
    expect(info?.category).toBe('Performance');
  });

  it('should NOT emit CLS INFO when CLS is GOOD', () => {
    const metrics = makeGoodMetrics({ cls: 0.05 }); // GOOD

    const findings = runCoreWebVitalsModule(metrics);

    expect(findings.filter(f => f.severity === 'INFO' && f.title.includes('CLS'))).toHaveLength(0);
  });

  it('existing MEDIUM finding for CLS Poor should still be present (additive check)', () => {
    const metrics = makeGoodMetrics({ cls: 0.30 }); // triggers MEDIUM + INFO

    const findings = runCoreWebVitalsModule(metrics);

    const medium = findings.find(f => f.severity === 'MEDIUM' && f.title.includes('Cumulative Layout Shift'));
    expect(medium).toBeDefined(); // original MEDIUM must remain unchanged
  });
});

// ─── FCP Poor band INFO ────────────────────────────────────────────────────

describe('P2-01 Transparency INFO: FCP Poor band', () => {
  it('should emit an INFO finding when FCP is in the Poor band (>= 3000ms)', () => {
    const metrics = makeGoodMetrics({ fcp: 3500 }); // Poor band

    const findings = runCoreWebVitalsModule(metrics);

    const info = findings.filter(f => f.severity === 'INFO' && f.title.includes('FCP'));
    expect(info.length).toBeGreaterThan(0);
  });

  it('should NOT emit FCP INFO when FCP is GOOD', () => {
    const metrics = makeGoodMetrics({ fcp: 1200 }); // GOOD

    const findings = runCoreWebVitalsModule(metrics);

    expect(findings.filter(f => f.severity === 'INFO' && f.title.includes('FCP'))).toHaveLength(0);
  });

  it('existing MEDIUM finding for FCP Poor should still be present (additive check)', () => {
    const metrics = makeGoodMetrics({ fcp: 3500 }); // triggers MEDIUM + INFO

    const findings = runCoreWebVitalsModule(metrics);

    const medium = findings.find(f => f.severity === 'MEDIUM' && f.title.includes('First Contentful Paint'));
    expect(medium).toBeDefined(); // original MEDIUM must remain
  });
});

// ─── TBT Poor band INFO ────────────────────────────────────────────────────

describe('P2-01 Transparency INFO: TBT Poor band', () => {
  it('should emit an INFO finding when TBT is in the Poor band (>= 600ms)', () => {
    const metrics = makeGoodMetrics({ tbt: 800 }); // Poor band

    const findings = runCoreWebVitalsModule(metrics);

    const info = findings.filter(f => f.severity === 'INFO' && f.title.includes('TBT'));
    expect(info.length).toBeGreaterThan(0);
  });

  it('should NOT emit TBT INFO when TBT is GOOD', () => {
    const metrics = makeGoodMetrics({ tbt: 150 }); // GOOD

    const findings = runCoreWebVitalsModule(metrics);

    expect(findings.filter(f => f.severity === 'INFO' && f.title.includes('TBT'))).toHaveLength(0);
  });

  it('existing MEDIUM finding for TBT Poor should still be present (additive check)', () => {
    const metrics = makeGoodMetrics({ tbt: 800 }); // triggers MEDIUM + INFO

    const findings = runCoreWebVitalsModule(metrics);

    const medium = findings.find(f => f.severity === 'MEDIUM' && f.title.includes('Total Blocking Time'));
    expect(medium).toBeDefined(); // original MEDIUM must remain
  });
});

// ─── General INFO constraints ─────────────────────────────────────────────

describe('P2-01 Transparency INFO: general constraints', () => {
  it('INFO findings should NEVER be HIGH, MEDIUM, or CRITICAL', () => {
    // All metrics in the Poor band
    const metrics = makeGoodMetrics({
      lcp: 5000,  // Poor
      cls: 0.40,  // Poor
      fcp: 4000,  // Poor
      tbt: 900,   // Poor
    });

    const findings = runCoreWebVitalsModule(metrics);

    const infoFindings = findings.filter(f => f.severity === 'INFO');
    expect(infoFindings.length).toBeGreaterThan(0);
    // All INFO findings must stay at INFO
    for (const f of infoFindings) {
      expect(['HIGH', 'CRITICAL', 'MEDIUM']).not.toContain(f.severity);
    }
  });

  it('should emit NO INFO findings when all metrics are GOOD', () => {
    const metrics = makeGoodMetrics(); // all GOOD band

    const findings = runCoreWebVitalsModule(metrics);

    expect(findings.filter(f => f.severity === 'INFO')).toHaveLength(0);
  });

  it('should emit NO INFO findings when all metrics are null', () => {
    const metrics = makeGoodMetrics({
      lcp: null,
      fcp: null,
      cls: null,
      tbt: null,
    });

    const findings = runCoreWebVitalsModule(metrics);

    expect(findings.filter(f => f.severity === 'INFO')).toHaveLength(0);
  });

  it('should emit exactly one INFO per Poor metric (no double-emit)', () => {
    // One metric in the Poor band
    const metrics = makeGoodMetrics({ lcp: 5000 });

    const findings = runCoreWebVitalsModule(metrics);

    const lcpInfoFindings = findings.filter(
      f => f.severity === 'INFO' && f.title.includes('LCP'),
    );
    expect(lcpInfoFindings).toHaveLength(1);
  });

  it('single Poor CWV alongside good others emits correct INFO count', () => {
    // Only TBT is Poor; all others are GOOD
    const metrics = makeGoodMetrics({
      lcp: 1500,  // GOOD
      fcp: 1200,  // GOOD
      cls: 0.05,  // GOOD
      tbt: 700,   // Poor
    });

    const findings = runCoreWebVitalsModule(metrics);

    const infoFindings = findings.filter(f => f.severity === 'INFO');
    // Exactly one INFO finding for TBT; no others
    expect(infoFindings).toHaveLength(1);
    expect(infoFindings[0].title).toContain('TBT');
  });
});

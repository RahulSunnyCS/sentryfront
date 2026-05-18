import { describe, it, expect } from 'vitest';
import {
  mergeAndCalibrateFindings,
  compressInfoBandFindings,
  buildSummaryFromFindings,
} from '@/lib/report-utils';
import type { Finding } from '@/types';

// ── Test factory ─────────────────────────────────────────────────────────────

let _counter = 0;
function makeFinding(overrides: Partial<Finding> & { module: string }): Finding {
  _counter++;
  return {
    id: overrides.id ?? `test-${_counter}`,
    module: overrides.module,
    category: overrides.category ?? 'Security',
    severity: overrides.severity ?? 'MEDIUM',
    title: overrides.title ?? 'Test finding',
    location: overrides.location ?? '/test',
    evidence: overrides.evidence ?? 'Test evidence',
    explanation: overrides.explanation ?? 'Test explanation',
    impact: overrides.impact ?? 'Test impact',
    fixManual: overrides.fixManual ?? ['Fix step 1'],
    fixAiPrompt: overrides.fixAiPrompt ?? 'Fix this',
    confidence: overrides.confidence ?? null,
    currentDisposition: overrides.currentDisposition ?? null,
  };
}

// ── C1: Legacy CRITICAL P1-06 HTTP 403 downgraded to HIGH ───────────────────

describe('mergeAndCalibrateFindings — C1: legacy CRITICAL P1-06 HTTP 403 downgrade', () => {
  it('downgrades a CRITICAL P1-06 finding with HTTP 403 evidence to HIGH', () => {
    const finding = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      title: '/.env publicly accessible',
      location: '/.env',
      evidence: 'GET /.env → HTTP 403',
    });

    const result = mergeAndCalibrateFindings([finding]);

    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('HIGH');
  });

  it('removes "publicly accessible" language from the downgraded title', () => {
    const finding = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      title: '/.env publicly accessible',
      location: '/.env',
      evidence: 'GET /.env → HTTP 403',
    });

    const result = mergeAndCalibrateFindings([finding]);

    expect(result[0].title).not.toMatch(/publicly accessible/i);
  });

  it('preserves the module identifier on the downgraded finding', () => {
    const finding = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      location: '/.env',
      evidence: 'GET /.env → HTTP 403',
    });

    const result = mergeAndCalibrateFindings([finding]);

    expect(result[0].module).toBe('P1-06');
  });
});

// ── C2: Two .env-family HTTP 403 → exactly ONE HIGH grouped finding ──────────

describe('mergeAndCalibrateFindings — C2: .env-family group merging', () => {
  it('emits exactly one HIGH finding for two .env-family HTTP 403 paths', () => {
    const env = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      location: '/.env',
      evidence: 'GET /.env → HTTP 403',
    });
    const envLocal = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      location: '/.env.local',
      evidence: 'GET /.env.local → HTTP 403',
    });

    const result = mergeAndCalibrateFindings([env, envLocal]);

    const highFindings = result.filter((f) => f.severity === 'HIGH');
    const criticalFindings = result.filter((f) => f.severity === 'CRITICAL');
    expect(highFindings).toHaveLength(1);
    expect(criticalFindings).toHaveLength(0);
  });

  it('includes both paths in the grouped finding location', () => {
    const env = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      location: '/.env',
      evidence: 'GET /.env → HTTP 403',
    });
    const envLocal = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      location: '/.env.local',
      evidence: 'GET /.env.local → HTTP 403',
    });

    const result = mergeAndCalibrateFindings([env, envLocal]);

    const grouped = result.find((f) => f.severity === 'HIGH');
    expect(grouped?.location).toContain('/.env');
    expect(grouped?.location).toContain('/.env.local');
  });

  it('includes both paths in the grouped finding evidence', () => {
    const env = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      location: '/.env',
      evidence: 'GET /.env → HTTP 403',
    });
    const envLocal = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      location: '/.env.local',
      evidence: 'GET /.env.local → HTTP 403',
    });

    const result = mergeAndCalibrateFindings([env, envLocal]);

    const grouped = result.find((f) => f.severity === 'HIGH');
    expect(grouped?.evidence).toContain('/.env');
    expect(grouped?.evidence).toContain('/.env.local');
  });
});

// ── C3: buildSummaryFromFindings ─────────────────────────────────────────────

describe('buildSummaryFromFindings — C3', () => {
  it('returns all zeros for an empty findings array', () => {
    const summary = buildSummaryFromFindings([]);
    expect(summary).toEqual({ CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 });
  });

  it('correctly counts a mixed severity findings array', () => {
    const findings = [
      makeFinding({ module: 'P1-01', severity: 'CRITICAL' }),
      makeFinding({ module: 'P1-02', severity: 'HIGH' }),
      makeFinding({ module: 'P1-03', severity: 'MEDIUM' }),
      makeFinding({ module: 'P1-04', severity: 'MEDIUM' }),
      makeFinding({ module: 'P1-05', severity: 'LOW' }),
      makeFinding({ module: 'P1-06', severity: 'INFO' }),
    ];

    const summary = buildSummaryFromFindings(findings);
    expect(summary).toEqual({ CRITICAL: 1, HIGH: 1, MEDIUM: 2, LOW: 1, INFO: 1 });
  });
});

// ── F1: .git-family group merging ────────────────────────────────────────────

describe('mergeAndCalibrateFindings — F1: .git-family group merging', () => {
  it('groups three .git-family CRITICAL HTTP 403 findings into a single HIGH finding', () => {
    const gitConfig = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      location: '/.git/config',
      evidence: 'GET /.git/config → HTTP 403',
    });
    const gitHead = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      location: '/.git/HEAD',
      evidence: 'GET /.git/HEAD → HTTP 403',
    });
    const gitCommit = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      location: '/.git/COMMIT_EDITMSG',
      evidence: 'GET /.git/COMMIT_EDITMSG → HTTP 403',
    });

    const result = mergeAndCalibrateFindings([gitConfig, gitHead, gitCommit]);

    const highFindings = result.filter((f) => f.severity === 'HIGH');
    const criticalFindings = result.filter((f) => f.severity === 'CRITICAL');
    expect(highFindings).toHaveLength(1);
    expect(criticalFindings).toHaveLength(0);
  });

  it('includes all three .git paths in the grouped finding', () => {
    const gitConfig = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      location: '/.git/config',
      evidence: 'GET /.git/config → HTTP 403',
    });
    const gitHead = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      location: '/.git/HEAD',
      evidence: 'GET /.git/HEAD → HTTP 403',
    });
    const gitCommit = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      location: '/.git/COMMIT_EDITMSG',
      evidence: 'GET /.git/COMMIT_EDITMSG → HTTP 403',
    });

    const result = mergeAndCalibrateFindings([gitConfig, gitHead, gitCommit]);

    const grouped = result.find((f) => f.severity === 'HIGH');
    expect(grouped?.location).toContain('/.git/config');
    expect(grouped?.location).toContain('/.git/HEAD');
    expect(grouped?.location).toContain('/.git/COMMIT_EDITMSG');
  });
});

// ── F2 (A1 regression): comma-joined location splits across families ─────────

describe('mergeAndCalibrateFindings — F2 (A1 regression): pre-joined multi-family location', () => {
  it('splits a comma-joined location into two separate HIGH findings by path family', () => {
    // A legacy finding whose location is already "/.env, /.git/config" (partially
    // pre-grouped). Should yield TWO separate HIGH findings: one for env family,
    // one for git family — not mis-bucketed into one group.
    const preGrouped = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      location: '/.env, /.git/config',
      evidence: 'GET /.env → HTTP 403',
    });

    const result = mergeAndCalibrateFindings([preGrouped]);

    // Both families should produce a finding
    const highFindings = result.filter((f) => f.severity === 'HIGH');
    expect(highFindings).toHaveLength(2);
  });

  it('assigns /.env to "Environment config" family and /.git/config to "Git repository" family', () => {
    const preGrouped = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      location: '/.env, /.git/config',
      evidence: 'GET /.env → HTTP 403',
    });

    const result = mergeAndCalibrateFindings([preGrouped]);

    const envFinding = result.find(
      (f) => f.severity === 'HIGH' && f.title.includes('Environment config'),
    );
    const gitFinding = result.find(
      (f) => f.severity === 'HIGH' && f.title.includes('Git repository'),
    );

    expect(envFinding).toBeDefined();
    expect(gitFinding).toBeDefined();
  });

  it('does not produce a single grouped finding that contains both families', () => {
    const preGrouped = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      location: '/.env, /.git/config',
      evidence: 'GET /.env → HTTP 403',
    });

    const result = mergeAndCalibrateFindings([preGrouped]);

    // No single finding should contain both paths in its location
    const singleWithBoth = result.find(
      (f) => f.location.includes('/.env') && f.location.includes('/.git/config'),
    );
    expect(singleWithBoth).toBeUndefined();
  });
});

// ── F3: Cross-module viewport duplicate (P2-06 vs P3-05) ─────────────────────

describe('mergeAndCalibrateFindings — F3: viewport dedup (P2-06 vs P3-05)', () => {
  it('suppresses P2-06 when both P2-06 and P3-05 findings contain maximum-scale evidence', () => {
    const p206 = makeFinding({
      module: 'P2-06',
      severity: 'LOW',
      title: 'Viewport restricts user scaling',
      evidence: 'meta viewport contains maximum-scale=1.0',
    });
    const p305 = makeFinding({
      module: 'P3-05',
      severity: 'MEDIUM',
      title: 'Viewport blocks user zoom (a11y)',
      evidence: 'user-scalable=no, maximum-scale=1 detected',
    });

    const result = mergeAndCalibrateFindings([p206, p305]);

    const p206Findings = result.filter((f) => f.module === 'P2-06');
    const p305Findings = result.filter((f) => f.module === 'P3-05');
    expect(p206Findings).toHaveLength(0);
    expect(p305Findings).toHaveLength(1);
  });

  it('retains a P2-06 viewport finding when no matching P3-05 exists', () => {
    const p206 = makeFinding({
      module: 'P2-06',
      severity: 'LOW',
      evidence: 'maximum-scale=1.0 found in viewport meta',
    });

    const result = mergeAndCalibrateFindings([p206]);

    expect(result.filter((f) => f.module === 'P2-06')).toHaveLength(1);
  });
});

// ── F4: P2-04 TBT duplicate of P2-01 TBT suppression ────────────────────────

describe('mergeAndCalibrateFindings — F4: P2-04 TBT duplicate suppression', () => {
  it('suppresses P2-04 blocking-time finding when P2-01 HIGH blocking-time finding exists', () => {
    const p201 = makeFinding({
      module: 'P2-01',
      severity: 'HIGH',
      title: 'High Total Blocking Time',
      evidence: 'Total blocking time: 850ms — over threshold',
    });
    const p204 = makeFinding({
      module: 'P2-04',
      severity: 'MEDIUM',
      title: 'JavaScript blocking time is high',
      evidence: 'Total blocking time (TBT): 850ms found in trace',
    });

    const result = mergeAndCalibrateFindings([p201, p204]);

    expect(result.filter((f) => f.module === 'P2-04')).toHaveLength(0);
    expect(result.filter((f) => f.module === 'P2-01')).toHaveLength(1);
  });

  it('keeps P2-04 when it mentions TTI in addition to blocking time', () => {
    const p201 = makeFinding({
      module: 'P2-01',
      severity: 'HIGH',
      evidence: 'Total blocking time: 700ms',
    });
    const p204WithTti = makeFinding({
      module: 'P2-04',
      severity: 'MEDIUM',
      evidence: 'Total blocking time: 700ms; Time to Interactive (TTI): 9.2s',
    });

    const result = mergeAndCalibrateFindings([p201, p204WithTti]);

    expect(result.filter((f) => f.module === 'P2-04')).toHaveLength(1);
  });

  it('keeps P2-04 when P2-01 blocking-time finding is absent', () => {
    const p204 = makeFinding({
      module: 'P2-04',
      severity: 'MEDIUM',
      evidence: 'Total blocking time: 500ms',
    });

    const result = mergeAndCalibrateFindings([p204]);

    expect(result.filter((f) => f.module === 'P2-04')).toHaveLength(1);
  });
});

// ── F6: compressInfoBandFindings ─────────────────────────────────────────────

describe('compressInfoBandFindings — F6: band finding extraction', () => {
  it('extracts an LCP INFO band finding into bandSummary and removes it from findings', () => {
    const lcpBand = makeFinding({
      module: 'P2-01',
      severity: 'INFO',
      title: 'LCP is in the Poor band',
      evidence: 'LCP: 10.30s — Poor threshold: ≥ 4.0s',
    });

    const { findings, bandSummary } = compressInfoBandFindings([lcpBand]);

    expect(findings).toHaveLength(0);
    expect(bandSummary).not.toBeNull();
    expect(bandSummary).toHaveLength(1);
  });

  it('correctly parses LCP band summary fields', () => {
    const lcpBand = makeFinding({
      module: 'P2-01',
      severity: 'INFO',
      title: 'LCP is in the Poor band',
      evidence: 'LCP: 10.30s — Poor threshold: ≥ 4.0s',
    });

    const { bandSummary } = compressInfoBandFindings([lcpBand]);

    expect(bandSummary![0]).toMatchObject({
      metric: 'LCP',
      value: '10.30s',
      band: 'Poor',
      threshold: '≥ 4.0s',
    });
  });

  it('returns bandSummary null when no band findings are present', () => {
    const regular = makeFinding({ module: 'P1-01', severity: 'HIGH' });

    const { findings, bandSummary } = compressInfoBandFindings([regular]);

    expect(findings).toHaveLength(1);
    expect(bandSummary).toBeNull();
  });

  it('keeps non-band findings in the findings array', () => {
    const regular = makeFinding({ module: 'P1-01', severity: 'HIGH' });
    const lcpBand = makeFinding({
      module: 'P2-01',
      severity: 'INFO',
      title: 'LCP is in the Poor band',
      evidence: 'LCP: 5.10s — Poor threshold: ≥ 4.0s',
    });

    const { findings, bandSummary } = compressInfoBandFindings([regular, lcpBand]);

    expect(findings).toHaveLength(1);
    expect(findings[0].module).toBe('P1-01');
    expect(bandSummary).toHaveLength(1);
  });

  it('does not extract a band finding that is not INFO severity', () => {
    const lcpHighBand = makeFinding({
      module: 'P2-01',
      severity: 'HIGH',
      title: 'LCP is in the Poor band',
      evidence: 'LCP: 10.30s — Poor threshold: ≥ 4.0s',
    });

    const { findings, bandSummary } = compressInfoBandFindings([lcpHighBand]);

    expect(findings).toHaveLength(1);
    expect(bandSummary).toBeNull();
  });

  it('does not extract a band finding from a non-P2-01 module', () => {
    const otherModuleBand = makeFinding({
      module: 'P2-02',
      severity: 'INFO',
      title: 'LCP is in the Poor band',
      evidence: 'LCP: 10.30s — Poor threshold: ≥ 4.0s',
    });

    const { findings, bandSummary } = compressInfoBandFindings([otherModuleBand]);

    expect(findings).toHaveLength(1);
    expect(bandSummary).toBeNull();
  });
});

// ── F8: P4-01 canonical 403 → MEDIUM ────────────────────────────────────────

describe('mergeAndCalibrateFindings — F8: P4-01 canonical 403 recalibration', () => {
  it('downgrades P4-01 HIGH canonical-403 finding to MEDIUM', () => {
    const canonical403 = makeFinding({
      module: 'P4-01',
      severity: 'HIGH',
      title: 'Canonical URL returns error',
      evidence: 'canonical URL https://example.com/ returned 403',
    });

    const result = mergeAndCalibrateFindings([canonical403]);

    expect(result.find((f) => f.module === 'P4-01')?.severity).toBe('MEDIUM');
  });

  it('does not change P4-01 HIGH finding with non-403 evidence', () => {
    const canonical200 = makeFinding({
      module: 'P4-01',
      severity: 'HIGH',
      title: 'Canonical URL mismatch',
      evidence: 'canonical tag points to a different URL',
    });

    const result = mergeAndCalibrateFindings([canonical200]);

    expect(result.find((f) => f.module === 'P4-01')?.severity).toBe('HIGH');
  });
});

// ── F9: P4-03 missing structured data → LOW ─────────────────────────────────

describe('mergeAndCalibrateFindings — F9: P4-03 structured data recalibration', () => {
  it('downgrades P4-03 MEDIUM missing-structured-data finding to LOW', () => {
    const structuredData = makeFinding({
      module: 'P4-03',
      severity: 'MEDIUM',
      title: 'missing structured data (JSON-LD)',
      evidence: 'No schema.org markup found on page',
    });

    const result = mergeAndCalibrateFindings([structuredData]);

    expect(result.find((f) => f.module === 'P4-03')?.severity).toBe('LOW');
  });

  it('does not change P4-03 MEDIUM finding whose title does not mention structured data', () => {
    const other = makeFinding({
      module: 'P4-03',
      severity: 'MEDIUM',
      title: 'Missing page title',
      evidence: 'No <title> tag found',
    });

    const result = mergeAndCalibrateFindings([other]);

    expect(result.find((f) => f.module === 'P4-03')?.severity).toBe('MEDIUM');
  });
});

// ── F10: P2-08 suppressed when P1-02 reports HTTP 200 sourcemaps ─────────────

describe('mergeAndCalibrateFindings — F10: P2-08 suppression via P1-02', () => {
  it('suppresses P2-08 when P1-02 has HTTP 200 in evidence (sourcemaps exposed)', () => {
    const p102 = makeFinding({
      module: 'P1-02',
      severity: 'HIGH',
      title: 'JavaScript sourcemaps exposed',
      evidence: 'GET /app.js.map → HTTP 200 (12 kB)',
    });
    const p208 = makeFinding({
      module: 'P2-08',
      severity: 'LOW',
      title: 'Missing JavaScript sourcemaps',
      evidence: 'No sourcemaps found for main bundle',
    });

    const result = mergeAndCalibrateFindings([p102, p208]);

    expect(result.filter((f) => f.module === 'P2-08')).toHaveLength(0);
    expect(result.filter((f) => f.module === 'P1-02')).toHaveLength(1);
  });

  it('keeps P2-08 when P1-02 has no HTTP 200 in evidence', () => {
    const p102NonExposed = makeFinding({
      module: 'P1-02',
      severity: 'LOW',
      evidence: 'GET /app.js.map → HTTP 404',
    });
    const p208 = makeFinding({
      module: 'P2-08',
      severity: 'LOW',
      title: 'Missing JavaScript sourcemaps',
    });

    const result = mergeAndCalibrateFindings([p102NonExposed, p208]);

    expect(result.filter((f) => f.module === 'P2-08')).toHaveLength(1);
  });
});

// ── F11: P1-09 known-safe CDN domain → LOW ───────────────────────────────────

describe('mergeAndCalibrateFindings — F11: P1-09 known-safe domain recalibration', () => {
  it('downgrades P1-09 MEDIUM finding with buttons.github.io in evidence to LOW', () => {
    const p109 = makeFinding({
      module: 'P1-09',
      severity: 'MEDIUM',
      title: 'Unrecognized third-party script',
      evidence: 'Script loaded from https://buttons.github.io/buttons.js',
      location: 'https://buttons.github.io/buttons.js',
    });

    const result = mergeAndCalibrateFindings([p109]);

    expect(result.find((f) => f.module === 'P1-09')?.severity).toBe('LOW');
  });

  it('appends CDN safe domain note to explanation when recalibrating', () => {
    const p109 = makeFinding({
      module: 'P1-09',
      severity: 'MEDIUM',
      evidence: 'https://buttons.github.io/buttons.js loaded',
      location: 'https://buttons.github.io/buttons.js',
    });

    const result = mergeAndCalibrateFindings([p109]);

    expect(result.find((f) => f.module === 'P1-09')?.explanation).toContain(
      'well-known CDN',
    );
  });

  it('does not downgrade P1-09 MEDIUM finding for an unknown third-party domain', () => {
    const p109Unknown = makeFinding({
      module: 'P1-09',
      severity: 'MEDIUM',
      evidence: 'https://unknown-cdn.example.com/tracker.js loaded',
      location: 'https://unknown-cdn.example.com/tracker.js',
    });

    const result = mergeAndCalibrateFindings([p109Unknown]);

    expect(result.find((f) => f.module === 'P1-09')?.severity).toBe('MEDIUM');
  });
});

// ── F12: P4-06 /llms.txt LOW → INFO ─────────────────────────────────────────

describe('mergeAndCalibrateFindings — F12: P4-06 /llms.txt recalibration', () => {
  it('downgrades P4-06 LOW finding to INFO', () => {
    const p406 = makeFinding({
      module: 'P4-06',
      severity: 'LOW',
      title: 'Missing /llms.txt',
      evidence: 'No /llms.txt file found',
    });

    const result = mergeAndCalibrateFindings([p406]);

    expect(result.find((f) => f.module === 'P4-06')?.severity).toBe('INFO');
  });

  it('does not change a P4-06 finding that is already INFO', () => {
    const p406Info = makeFinding({
      module: 'P4-06',
      severity: 'INFO',
      title: '/llms.txt present',
    });

    const result = mergeAndCalibrateFindings([p406Info]);

    expect(result.find((f) => f.module === 'P4-06')?.severity).toBe('INFO');
  });
});

// ── F13: P5-04 LOW/MEDIUM → INFO ────────────────────────────────────────────

describe('mergeAndCalibrateFindings — F13: P5-04 recalibration to INFO', () => {
  it('downgrades P5-04 LOW finding to INFO', () => {
    const p504 = makeFinding({
      module: 'P5-04',
      severity: 'LOW',
      title: 'No WCAG accessibility attestation found',
    });

    const result = mergeAndCalibrateFindings([p504]);

    expect(result.find((f) => f.module === 'P5-04')?.severity).toBe('INFO');
  });

  it('downgrades P5-04 MEDIUM finding to INFO', () => {
    const p504 = makeFinding({
      module: 'P5-04',
      severity: 'MEDIUM',
      title: 'No WCAG accessibility attestation found',
    });

    const result = mergeAndCalibrateFindings([p504]);

    expect(result.find((f) => f.module === 'P5-04')?.severity).toBe('INFO');
  });
});

// ── F14: buildSummaryFromFindings with known counts ──────────────────────────

describe('buildSummaryFromFindings — F14: mixed severity count', () => {
  it('counts 1 HIGH + 2 MEDIUM + 1 LOW correctly', () => {
    const findings = [
      makeFinding({ module: 'P1-01', severity: 'HIGH' }),
      makeFinding({ module: 'P1-02', severity: 'MEDIUM' }),
      makeFinding({ module: 'P1-03', severity: 'MEDIUM' }),
      makeFinding({ module: 'P1-04', severity: 'LOW' }),
    ];

    const summary = buildSummaryFromFindings(findings);

    expect(summary).toEqual({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 1, INFO: 0 });
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe('mergeAndCalibrateFindings — edge cases', () => {
  it('returns an empty array for empty input', () => {
    const result = mergeAndCalibrateFindings([]);
    expect(result).toEqual([]);
  });

  it('does not mutate the original input array', () => {
    const finding = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      location: '/.env',
      evidence: 'GET /.env → HTTP 403',
    });
    const input = [finding];

    mergeAndCalibrateFindings(input);

    expect(input).toHaveLength(1);
    expect(input[0].severity).toBe('CRITICAL');
  });

  it('does not downgrade a non-P1-06 CRITICAL finding', () => {
    const criticalSecret = makeFinding({
      module: 'P1-01',
      severity: 'CRITICAL',
      title: 'API key exposed',
      evidence: 'Stripe secret key found in bundle',
    });

    const result = mergeAndCalibrateFindings([criticalSecret]);

    expect(result.find((f) => f.module === 'P1-01')?.severity).toBe('CRITICAL');
  });

  it('does not group a P1-06 CRITICAL finding with HTTP 200 in evidence', () => {
    // HTTP 200 means the file is publicly readable — keep as CRITICAL, not grouped
    const criticalExposed = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      title: '/.env publicly accessible',
      location: '/.env',
      evidence: 'GET /.env → HTTP 200',
    });

    const result = mergeAndCalibrateFindings([criticalExposed]);

    expect(result.find((f) => f.module === 'P1-06')?.severity).toBe('CRITICAL');
    // No grouping: should remain as-is, location unchanged
    expect(result.find((f) => f.module === 'P1-06')?.location).toBe('/.env');
  });

  it('does not downgrade a P1-06 CRITICAL finding with no HTTP status in evidence', () => {
    // No parseable status → fail-safe: do not silently downgrade
    const noStatus = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      location: '/.env',
      evidence: 'Environment file was accessible',
    });

    const result = mergeAndCalibrateFindings([noStatus]);

    expect(result.find((f) => f.module === 'P1-06')?.severity).toBe('CRITICAL');
  });

  it('passes through a P1-06 HTTP 200 CRITICAL finding unchanged per-path', () => {
    const exposed = makeFinding({
      module: 'P1-06',
      severity: 'CRITICAL',
      title: '/.env publicly accessible',
      location: '/.env',
      evidence: 'GET /.env → HTTP 200 (1.2 kB returned)',
    });

    const result = mergeAndCalibrateFindings([exposed]);

    // Must remain CRITICAL and be kept individually
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('CRITICAL');
    expect(result[0].location).toBe('/.env');
  });
});

describe('compressInfoBandFindings — edge cases', () => {
  it('returns unchanged findings and null bandSummary for empty input', () => {
    const { findings, bandSummary } = compressInfoBandFindings([]);
    expect(findings).toEqual([]);
    expect(bandSummary).toBeNull();
  });

  it('handles multiple band metrics in a single call', () => {
    const lcpBand = makeFinding({
      module: 'P2-01',
      severity: 'INFO',
      title: 'LCP is in the Poor band',
      evidence: 'LCP: 5.10s — Poor threshold: ≥ 4.0s',
    });
    // BAND_FINDING_RE uses \w+ which matches a single word — use "Slow" not "Needs improvement"
    const fcpBand = makeFinding({
      module: 'P2-01',
      severity: 'INFO',
      title: 'FCP is in the Slow band',
      evidence: 'FCP: 2.10s — Slow threshold: ≥ 1.8s',
    });

    const { findings, bandSummary } = compressInfoBandFindings([lcpBand, fcpBand]);

    expect(findings).toHaveLength(0);
    expect(bandSummary).toHaveLength(2);
    const metrics = bandSummary!.map((b) => b.metric);
    expect(metrics).toContain('LCP');
    expect(metrics).toContain('FCP');
  });
});

// ── Header dedup: P1-03 + P5-03 CSP ─────────────────────────────────────────

describe('mergeAndCalibrateFindings — header dedup (P1-03 vs P5-03)', () => {
  it('keeps only one CSP finding when both P1-03 and P5-03 emit CSP findings', () => {
    // Both titles must include the same keyword from DEDUP_HEADERS for the dedup to
    // fire. The dedup iterates ['content-security-policy', 'csp', ...] and matches
    // via title.toLowerCase().includes(header). Using 'csp' in both titles ensures
    // a single dedup pass covers both findings.
    const p103Csp = makeFinding({
      module: 'P1-03',
      severity: 'HIGH',
      title: 'Missing CSP header',
      evidence: 'content-security-policy absent',
    });
    const p503Csp = makeFinding({
      module: 'P5-03',
      severity: 'MEDIUM',
      title: 'No CSP header detected',
      evidence: 'content-security-policy not present',
    });

    const result = mergeAndCalibrateFindings([p103Csp, p503Csp]);

    const cspFindings = result.filter(
      (f) =>
        (f.module === 'P1-03' || f.module === 'P5-03') &&
        f.title.toLowerCase().includes('csp'),
    );
    expect(cspFindings).toHaveLength(1);
  });

  it('retains the higher-severity CSP finding (P1-03 HIGH over P5-03 MEDIUM)', () => {
    const p103Csp = makeFinding({
      module: 'P1-03',
      severity: 'HIGH',
      title: 'Missing CSP header',
      evidence: 'no content-security-policy',
    });
    const p503Csp = makeFinding({
      module: 'P5-03',
      severity: 'MEDIUM',
      title: 'CSP header missing',
      evidence: 'content-security-policy absent',
    });

    const result = mergeAndCalibrateFindings([p103Csp, p503Csp]);

    const surviving = result.find(
      (f) =>
        (f.module === 'P1-03' || f.module === 'P5-03') &&
        f.title.toLowerCase().includes('csp'),
    );
    expect(surviving?.module).toBe('P1-03');
    expect(surviving?.severity).toBe('HIGH');
  });

  it('keeps a P1-03 CSP finding when no matching P5-03 exists', () => {
    const p103Csp = makeFinding({
      module: 'P1-03',
      severity: 'HIGH',
      title: 'Missing CSP header',
    });

    const result = mergeAndCalibrateFindings([p103Csp]);

    expect(result.filter((f) => f.module === 'P1-03')).toHaveLength(1);
  });

  it('retains P5-03 CSP finding when P5-03 has higher severity than P1-03', () => {
    // Both titles include 'csp' so the dedup logic fires correctly.
    const p103Csp = makeFinding({
      module: 'P1-03',
      severity: 'LOW',
      title: 'CSP header could be improved',
    });
    const p503Csp = makeFinding({
      module: 'P5-03',
      severity: 'HIGH',
      title: 'CSP misconfiguration detected',
    });

    const result = mergeAndCalibrateFindings([p103Csp, p503Csp]);

    const p103Remaining = result.filter((f) => f.module === 'P1-03');
    const p503Remaining = result.filter((f) => f.module === 'P5-03');
    expect(p103Remaining).toHaveLength(0);
    expect(p503Remaining).toHaveLength(1);
  });
});

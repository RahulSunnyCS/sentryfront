/**
 * Unit tests for p1-16-client-deps.ts
 *
 * Covers:
 *   - assignSeverity(): all CVSS score thresholds + edge cases
 *   - runClientDepsModule(): happy path, empty chunks, no components,
 *     no vulnerabilities, feature-flag branching (exploitIntelSeverity),
 *     error isolation (module never throws)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assignSeverity, runClientDepsModule } from '@/lib/scanner/modules/p1-16-client-deps';
import type { CrawlResult } from '@/lib/scanner/types';

// ── External dependencies mocked ───────────────────────────────────────────

vi.mock('@/lib/scanner/tools/retire', () => ({
  detectAcrossChunks: vi.fn(),
}));

vi.mock('@/lib/scanner/tools/osv', () => ({
  queryBatch: vi.fn(),
  getVuln: vi.fn(),
  extractCvssBaseScore: vi.fn(),
}));

vi.mock('@/lib/scanner/tools/severity-rubric', () => ({
  resolveSeverity: vi.fn(),
}));

const mockFeatures = {
  exploitIntelSeverity: false,
  pwaSurfaceChecks: false,
  performanceScanning: true,
  accessibilityScanning: true,
  seoScanning: true,
  llmEnrichment: true,
  stripe: false,
};

vi.mock('@/lib/features', () => ({
  get features() {
    return mockFeatures;
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { detectAcrossChunks } from '@/lib/scanner/tools/retire';
import { queryBatch, getVuln, extractCvssBaseScore } from '@/lib/scanner/tools/osv';
import { resolveSeverity } from '@/lib/scanner/tools/severity-rubric';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeCrawlResult(overrides: Partial<CrawlResult> = {}): CrawlResult {
  return {
    finalUrl: 'https://example.com',
    statusCode: 200,
    headers: {},
    cookies: [],
    jsBundleUrls: [],
    inlineScriptContent: '',
    html: '<html></html>',
    tls: null,
    stack: 'React',
    // loadedChunkContents absent → falls back to jsBundleUrls path
    ...overrides,
  };
}

function makeDetectedComponent(overrides = {}) {
  return {
    npmName: 'jquery',
    version: '1.11.0',
    chunkUrl: 'https://example.com/vendor.js',
    ...overrides,
  };
}

function makeOsvVuln(id = 'GHSA-0001-0001-0001', aliases: string[] = [], summary = 'XSS vulnerability') {
  return { id, aliases, summary };
}

// ── assignSeverity() ───────────────────────────────────────────────────────

describe('assignSeverity()', () => {
  it('returns LOW when scores array is empty', () => {
    expect(assignSeverity([])).toBe('LOW');
  });

  it('returns LOW when max score is below 4.0', () => {
    expect(assignSeverity([0])).toBe('LOW');
    expect(assignSeverity([1.5, 3.9])).toBe('LOW');
    expect(assignSeverity([3.99])).toBe('LOW');
  });

  it('returns MEDIUM when max score is exactly 4.0', () => {
    expect(assignSeverity([4.0])).toBe('MEDIUM');
  });

  it('returns MEDIUM when max score is in [4.0, 7.0)', () => {
    expect(assignSeverity([4.1])).toBe('MEDIUM');
    expect(assignSeverity([6.9])).toBe('MEDIUM');
    expect(assignSeverity([5.0, 3.0])).toBe('MEDIUM');
  });

  it('returns HIGH when max score is exactly 7.0', () => {
    expect(assignSeverity([7.0])).toBe('HIGH');
  });

  it('returns HIGH when max score is in [7.0, 9.0)', () => {
    expect(assignSeverity([7.5])).toBe('HIGH');
    expect(assignSeverity([8.9])).toBe('HIGH');
    expect(assignSeverity([6.0, 8.0])).toBe('HIGH');
  });

  it('returns CRITICAL when max score is exactly 9.0', () => {
    expect(assignSeverity([9.0])).toBe('CRITICAL');
  });

  it('returns CRITICAL when max score is >= 9.0', () => {
    expect(assignSeverity([9.1])).toBe('CRITICAL');
    expect(assignSeverity([10.0])).toBe('CRITICAL');
    expect(assignSeverity([5.0, 9.5])).toBe('CRITICAL');
  });

  it('uses max across multiple scores (not first or last)', () => {
    // Scores span LOW through CRITICAL — the max (9.5) should win
    expect(assignSeverity([2.0, 5.5, 9.5, 7.0])).toBe('CRITICAL');
  });

  it('returns LOW for a single score of 0', () => {
    expect(assignSeverity([0])).toBe('LOW');
  });

  it('boundary: 3.9999 → LOW, 4.0001 → MEDIUM', () => {
    expect(assignSeverity([3.9999])).toBe('LOW');
    expect(assignSeverity([4.0001])).toBe('MEDIUM');
  });

  it('boundary: 6.9999 → MEDIUM, 7.0001 → HIGH', () => {
    expect(assignSeverity([6.9999])).toBe('MEDIUM');
    expect(assignSeverity([7.0001])).toBe('HIGH');
  });

  it('boundary: 8.9999 → HIGH, 9.0001 → CRITICAL', () => {
    expect(assignSeverity([8.9999])).toBe('HIGH');
    expect(assignSeverity([9.0001])).toBe('CRITICAL');
  });
});

// ── runClientDepsModule() ──────────────────────────────────────────────────

describe('runClientDepsModule()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatures.exploitIntelSeverity = false;
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('returns a finding for a detected vulnerable component', async () => {
      const component = makeDetectedComponent();
      vi.mocked(detectAcrossChunks).mockResolvedValue([component]);
      vi.mocked(queryBatch).mockResolvedValue([['GHSA-0001-0001-0001']]);
      vi.mocked(getVuln).mockResolvedValue(makeOsvVuln('GHSA-0001-0001-0001', ['CVE-2021-11111']));
      vi.mocked(extractCvssBaseScore).mockReturnValue(7.5);

      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/vendor.js': 'jquery content here' },
      });

      const findings = await runClientDepsModule(crawl);

      expect(findings).toHaveLength(1);
      const f = findings[0];
      expect(f.moduleId).toBe('P1-16');
      expect(f.severity).toBe('HIGH'); // CVSS 7.5 → HIGH
      expect(f.category).toBe('Vulnerable Client-Side Dependency');
      expect(f.title).toContain('jquery');
      expect(f.title).toContain('1.11.0');
      expect(f.evidence).toContain('CVE-2021-11111');
      expect(f.location).toBe('https://example.com/vendor.js');
    });

    it('prefers CVE alias over OSV ID in evidence and title', async () => {
      const component = makeDetectedComponent({ npmName: 'lodash', version: '4.17.4' });
      vi.mocked(detectAcrossChunks).mockResolvedValue([component]);
      vi.mocked(queryBatch).mockResolvedValue([['GHSA-abcd-efgh-ijkl']]);
      vi.mocked(getVuln).mockResolvedValue(
        makeOsvVuln('GHSA-abcd-efgh-ijkl', ['CVE-2021-23337'], 'Prototype pollution'),
      );
      vi.mocked(extractCvssBaseScore).mockReturnValue(7.2);

      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/main.js': 'lodash content' },
      });

      const findings = await runClientDepsModule(crawl);

      expect(findings[0].evidence).toContain('CVE-2021-23337');
      expect(findings[0].evidence).not.toContain('GHSA-abcd-efgh-ijkl');
    });

    it('falls back to OSV ID when no CVE alias exists', async () => {
      const component = makeDetectedComponent();
      vi.mocked(detectAcrossChunks).mockResolvedValue([component]);
      vi.mocked(queryBatch).mockResolvedValue([['GHSA-no-cve-alias']]);
      vi.mocked(getVuln).mockResolvedValue(
        makeOsvVuln('GHSA-no-cve-alias', [], 'Some vulnerability'),
      );
      vi.mocked(extractCvssBaseScore).mockReturnValue(5.0);

      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/vendor.js': 'content' },
      });

      const findings = await runClientDepsModule(crawl);
      expect(findings[0].evidence).toContain('GHSA-no-cve-alias');
    });

    it('returns multiple findings for multiple vulnerable components', async () => {
      const components = [
        makeDetectedComponent({ npmName: 'jquery', version: '1.11.0', chunkUrl: 'https://example.com/a.js' }),
        makeDetectedComponent({ npmName: 'lodash', version: '4.17.4', chunkUrl: 'https://example.com/b.js' }),
      ];
      vi.mocked(detectAcrossChunks).mockResolvedValue(components);
      vi.mocked(queryBatch).mockResolvedValue([
        ['GHSA-jquery-vuln'],
        ['GHSA-lodash-vuln'],
      ]);
      vi.mocked(getVuln)
        .mockResolvedValueOnce(makeOsvVuln('GHSA-jquery-vuln', ['CVE-2019-11358'], 'XSS'))
        .mockResolvedValueOnce(makeOsvVuln('GHSA-lodash-vuln', ['CVE-2021-23337'], 'Prototype pollution'));
      vi.mocked(extractCvssBaseScore).mockReturnValue(6.5);

      const crawl = makeCrawlResult({
        loadedChunkContents: {
          'https://example.com/a.js': 'jquery',
          'https://example.com/b.js': 'lodash',
        },
      });

      const findings = await runClientDepsModule(crawl);
      expect(findings).toHaveLength(2);
      const names = findings.map((f) => f.title);
      expect(names.some((t) => t.includes('jquery'))).toBe(true);
      expect(names.some((t) => t.includes('lodash'))).toBe(true);
    });
  });

  // ── Empty chunks ──────────────────────────────────────────────────────────

  describe('no chunks available', () => {
    it('returns empty array when loadedChunkContents is empty and jsBundleUrls is empty', async () => {
      const crawl = makeCrawlResult({
        loadedChunkContents: {},
        jsBundleUrls: [],
      });

      const findings = await runClientDepsModule(crawl);

      expect(findings).toEqual([]);
      expect(detectAcrossChunks).not.toHaveBeenCalled();
    });

    it('skips chunks whose content exceeds MAX_CHUNK_BYTES (2 MB)', async () => {
      const bigContent = 'x'.repeat(2 * 1024 * 1024 + 1); // just over the limit
      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/huge.js': bigContent },
      });

      const findings = await runClientDepsModule(crawl);

      // No chunks pass the size filter → detectAcrossChunks gets empty list → returns []
      expect(findings).toEqual([]);
    });
  });

  // ── No components detected ────────────────────────────────────────────────

  describe('no components detected', () => {
    it('returns empty array when retire detects no components', async () => {
      vi.mocked(detectAcrossChunks).mockResolvedValue([]);

      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/vendor.js': 'some content' },
      });

      const findings = await runClientDepsModule(crawl);

      expect(findings).toEqual([]);
      expect(queryBatch).not.toHaveBeenCalled();
    });
  });

  // ── No vulnerabilities found ──────────────────────────────────────────────

  describe('no vulnerabilities for detected components', () => {
    it('returns empty array when OSV reports no vulns for all components', async () => {
      vi.mocked(detectAcrossChunks).mockResolvedValue([makeDetectedComponent()]);
      vi.mocked(queryBatch).mockResolvedValue([[]]); // empty vuln ID list

      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/vendor.js': 'jquery' },
      });

      const findings = await runClientDepsModule(crawl);
      expect(findings).toEqual([]);
    });

    it('returns empty array when vuln IDs exist but all getVuln calls return null', async () => {
      vi.mocked(detectAcrossChunks).mockResolvedValue([makeDetectedComponent()]);
      vi.mocked(queryBatch).mockResolvedValue([['GHSA-unknown']]);
      vi.mocked(getVuln).mockResolvedValue(null); // hydration fails

      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/vendor.js': 'jquery' },
      });

      const findings = await runClientDepsModule(crawl);
      expect(findings).toEqual([]);
    });
  });

  // ── Feature flag: exploitIntelSeverity ────────────────────────────────────

  describe('feature flag — exploitIntelSeverity', () => {
    it('calls resolveSeverity (KEV+EPSS) when flag is on', async () => {
      mockFeatures.exploitIntelSeverity = true;

      vi.mocked(detectAcrossChunks).mockResolvedValue([makeDetectedComponent()]);
      vi.mocked(queryBatch).mockResolvedValue([['GHSA-0001-0001-0001']]);
      vi.mocked(getVuln).mockResolvedValue(makeOsvVuln('GHSA-0001-0001-0001', ['CVE-2021-11111']));
      vi.mocked(extractCvssBaseScore).mockReturnValue(7.5);
      vi.mocked(resolveSeverity).mockResolvedValue({
        severity: 'CRITICAL',
        kevMatch: true,
        epssPercentile: 0.97,
      });

      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/vendor.js': 'jquery content' },
      });

      const findings = await runClientDepsModule(crawl);

      expect(resolveSeverity).toHaveBeenCalled();
      expect(findings[0].severity).toBe('CRITICAL');
      expect(findings[0].kevMatch).toBe(true);
      expect(findings[0].epssPercentile).toBe(0.97);
    });

    it('calls assignSeverity (CVSS only) when flag is off', async () => {
      mockFeatures.exploitIntelSeverity = false;

      vi.mocked(detectAcrossChunks).mockResolvedValue([makeDetectedComponent()]);
      vi.mocked(queryBatch).mockResolvedValue([['GHSA-0001-0001-0001']]);
      vi.mocked(getVuln).mockResolvedValue(makeOsvVuln('GHSA-0001-0001-0001', ['CVE-2021-11111']));
      vi.mocked(extractCvssBaseScore).mockReturnValue(7.5);

      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/vendor.js': 'jquery content' },
      });

      const findings = await runClientDepsModule(crawl);

      expect(resolveSeverity).not.toHaveBeenCalled();
      // CVSS 7.5 → HIGH via assignSeverity
      expect(findings[0].severity).toBe('HIGH');
    });

    it('does not set kevMatch or epssPercentile when flag is off', async () => {
      mockFeatures.exploitIntelSeverity = false;

      vi.mocked(detectAcrossChunks).mockResolvedValue([makeDetectedComponent()]);
      vi.mocked(queryBatch).mockResolvedValue([['GHSA-0001-0001-0001']]);
      vi.mocked(getVuln).mockResolvedValue(makeOsvVuln('GHSA-0001-0001-0001', ['CVE-2021-11111']));
      vi.mocked(extractCvssBaseScore).mockReturnValue(9.0);

      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/vendor.js': 'jquery content' },
      });

      const findings = await runClientDepsModule(crawl);
      // These fields should be undefined (not set) when exploitIntelSeverity is off
      expect(findings[0].kevMatch).toBeUndefined();
      expect(findings[0].epssPercentile).toBeUndefined();
    });
  });

  // ── CVSS score → severity mapping via CVSS scores ─────────────────────────

  describe('CVSS score severity via assignSeverity path (flag off)', () => {
    async function findingForScore(cvssScore: number) {
      vi.mocked(detectAcrossChunks).mockResolvedValue([makeDetectedComponent()]);
      vi.mocked(queryBatch).mockResolvedValue([['GHSA-test']]);
      vi.mocked(getVuln).mockResolvedValue(makeOsvVuln('GHSA-test', ['CVE-2021-00001']));
      vi.mocked(extractCvssBaseScore).mockReturnValue(cvssScore);

      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/vendor.js': 'content' },
      });

      const findings = await runClientDepsModule(crawl);
      vi.clearAllMocks();
      return findings[0];
    }

    it('CVSS 3.9 → LOW severity finding', async () => {
      const f = await findingForScore(3.9);
      expect(f.severity).toBe('LOW');
    });

    it('CVSS 5.5 → MEDIUM severity finding', async () => {
      const f = await findingForScore(5.5);
      expect(f.severity).toBe('MEDIUM');
    });

    it('CVSS 7.5 → HIGH severity finding', async () => {
      const f = await findingForScore(7.5);
      expect(f.severity).toBe('HIGH');
    });

    it('CVSS 9.8 → CRITICAL severity finding', async () => {
      const f = await findingForScore(9.8);
      expect(f.severity).toBe('CRITICAL');
    });
  });

  // ── Error isolation ────────────────────────────────────────────────────────

  describe('error isolation', () => {
    it('returns empty array when detectAcrossChunks throws (never propagates)', async () => {
      vi.mocked(detectAcrossChunks).mockRejectedValue(new Error('retire.js exploded'));

      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/vendor.js': 'content' },
      });

      const findings = await runClientDepsModule(crawl);
      expect(findings).toEqual([]);
    });

    it('returns empty array when queryBatch throws', async () => {
      vi.mocked(detectAcrossChunks).mockResolvedValue([makeDetectedComponent()]);
      vi.mocked(queryBatch).mockRejectedValue(new Error('OSV network error'));

      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/vendor.js': 'content' },
      });

      const findings = await runClientDepsModule(crawl);
      expect(findings).toEqual([]);
    });

    it('returns empty array when resolveSeverity throws (exploitIntelSeverity on)', async () => {
      mockFeatures.exploitIntelSeverity = true;

      vi.mocked(detectAcrossChunks).mockResolvedValue([makeDetectedComponent()]);
      vi.mocked(queryBatch).mockResolvedValue([['GHSA-test']]);
      vi.mocked(getVuln).mockResolvedValue(makeOsvVuln('GHSA-test', ['CVE-2021-99999']));
      vi.mocked(extractCvssBaseScore).mockReturnValue(8.0);
      vi.mocked(resolveSeverity).mockRejectedValue(new Error('KEV API down'));

      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/vendor.js': 'content' },
      });

      const findings = await runClientDepsModule(crawl);
      expect(findings).toEqual([]);
    });
  });

  // ── Fallback path (no loadedChunkContents) ────────────────────────────────

  describe('fetch-only fallback path (no loadedChunkContents)', () => {
    it('uses jsBundleUrls to fetch chunks when loadedChunkContents is absent', async () => {
      // No loadedChunkContents means it falls through to the fetch path
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'jquery content',
      });

      vi.mocked(detectAcrossChunks).mockResolvedValue([]);

      const crawl = makeCrawlResult({
        jsBundleUrls: ['https://example.com/vendor.js'],
        // loadedChunkContents intentionally absent
      });

      const findings = await runClientDepsModule(crawl);
      expect(findings).toEqual([]);
      // fetch was called for the bundle URL
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/vendor.js',
        expect.objectContaining({ signal: expect.anything() }),
      );
    });

    it('handles fetch failure gracefully (returns empty content for that bundle)', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      vi.mocked(detectAcrossChunks).mockResolvedValue([]);

      const crawl = makeCrawlResult({
        jsBundleUrls: ['https://example.com/vendor.js'],
      });

      const findings = await runClientDepsModule(crawl);
      expect(findings).toEqual([]);
    });
  });

  // ── Finding shape ─────────────────────────────────────────────────────────

  describe('finding content and shape', () => {
    beforeEach(() => {
      vi.mocked(detectAcrossChunks).mockResolvedValue([
        makeDetectedComponent({ npmName: 'bootstrap', version: '3.0.0', chunkUrl: 'https://example.com/boot.js' }),
      ]);
      vi.mocked(queryBatch).mockResolvedValue([['GHSA-boot-vuln']]);
      vi.mocked(getVuln).mockResolvedValue(makeOsvVuln('GHSA-boot-vuln', ['CVE-2022-12345'], 'XSS in tooltip'));
      vi.mocked(extractCvssBaseScore).mockReturnValue(6.5);
    });

    it('includes the library name and version in the title', async () => {
      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/boot.js': 'bootstrap content' },
      });
      const findings = await runClientDepsModule(crawl);
      expect(findings[0].title).toContain('bootstrap');
      expect(findings[0].title).toContain('3.0.0');
    });

    it('sets location to the chunk URL where the library was found', async () => {
      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/boot.js': 'bootstrap content' },
      });
      const findings = await runClientDepsModule(crawl);
      expect(findings[0].location).toBe('https://example.com/boot.js');
    });

    it('includes the CVE ID in the evidence', async () => {
      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/boot.js': 'bootstrap content' },
      });
      const findings = await runClientDepsModule(crawl);
      expect(findings[0].evidence).toContain('CVE-2022-12345');
    });

    it('provides non-empty fixManual steps', async () => {
      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/boot.js': 'bootstrap content' },
      });
      const findings = await runClientDepsModule(crawl);
      expect(findings[0].fixManual.length).toBeGreaterThan(0);
    });

    it('provides a non-empty fixAiPrompt', async () => {
      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/boot.js': 'bootstrap content' },
      });
      const findings = await runClientDepsModule(crawl);
      expect(findings[0].fixAiPrompt).toBeTruthy();
      expect(findings[0].fixAiPrompt).toContain('bootstrap');
    });

    it('uses plural "vulnerabilities" in title when there are multiple CVEs', async () => {
      // Two vuln IDs hydrated → count = 2 → "vulnerabilities"
      vi.mocked(queryBatch).mockResolvedValue([['GHSA-1', 'GHSA-2']]);
      vi.mocked(getVuln)
        .mockResolvedValueOnce(makeOsvVuln('GHSA-1', ['CVE-2021-00001'], 'Vuln 1'))
        .mockResolvedValueOnce(makeOsvVuln('GHSA-2', ['CVE-2021-00002'], 'Vuln 2'));
      vi.mocked(extractCvssBaseScore).mockReturnValue(5.0);

      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/boot.js': 'bootstrap content' },
      });
      const findings = await runClientDepsModule(crawl);
      expect(findings[0].title).toContain('vulnerabilities');
    });

    it('uses singular "vulnerability" in title when there is exactly one CVE', async () => {
      const crawl = makeCrawlResult({
        loadedChunkContents: { 'https://example.com/boot.js': 'bootstrap content' },
      });
      const findings = await runClientDepsModule(crawl);
      expect(findings[0].title).toContain('vulnerability');
    });
  });
});

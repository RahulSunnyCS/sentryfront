/**
 * QA Gap: originLoadingExperience does NOT overwrite the URL-level headline verdict (🟡)
 *
 * QA checklist case:
 *   "`originLoadingExperience` is parsed into a separate context-only block and
 *    never promoted to the headline verdict or URL-level field block"
 *
 *   Pass if: The headline/URL field verdict reflects 'FAST' (from loadingExperience);
 *            the origin block is stored separately and labelled as context-only.
 *   Fail if: The origin verdict overwrites or appears as the URL-level headline verdict.
 *
 * The existing lighthouse.test.ts (`parses originLoadingExperience into originFieldData
 * independently`) verifies that the origin block is PARSED correctly into a separate
 * `originFieldData` field. However it does NOT verify the scenario where:
 *   - loadingExperience.overall_category = 'FAST'  (URL-level)
 *   - originLoadingExperience.overall_category = 'SLOW' (origin-level)
 *
 * This test pins the critical contract: the URL-level verdict must be 'FAST'
 * and the origin verdict must NOT appear in `fieldData.overallCategory`.
 *
 * This file contains no mocks beyond what vitest.setup.ts provides — it mocks
 * fetch directly to feed a controlled PSI fixture.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runLighthouse } from '@/lib/scanner/lighthouse';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** Minimal PSI response with both URL-level and origin-level CrUX blocks */
function makeResponseWithBothBlocks({
  urlCategory,
  originCategory,
}: {
  urlCategory: 'FAST' | 'AVERAGE' | 'SLOW';
  originCategory: 'FAST' | 'AVERAGE' | 'SLOW';
}) {
  return {
    lighthouseResult: {
      categories: {
        performance: { score: 0.88 },
        accessibility: { score: 0.92 },
        seo: { score: 0.97 },
      },
      audits: {
        'largest-contentful-paint': { numericValue: 2000 },
        'first-contentful-paint': { numericValue: 1100 },
        'cumulative-layout-shift': { numericValue: 0.06 },
        'total-blocking-time': { numericValue: 150 },
        'interactive': { numericValue: 3200 },
        'speed-index': { numericValue: 2800 },
        'server-response-time': { numericValue: 280 },
      },
    },
    // URL-level field data — this is the headline verdict
    loadingExperience: {
      overall_category: urlCategory,
      metrics: {
        LARGEST_CONTENTFUL_PAINT_MS: {
          percentile: urlCategory === 'FAST' ? 1800 : 5000,
          category: urlCategory,
          distributions: [],
        },
      },
    },
    // Origin-level field data — context-only, must NEVER become the headline verdict
    originLoadingExperience: {
      overall_category: originCategory,
      metrics: {
        LARGEST_CONTENTFUL_PAINT_MS: {
          percentile: originCategory === 'SLOW' ? 4800 : 1500,
          category: originCategory,
          distributions: [],
        },
      },
    },
  };
}

function mockFetchOk(body: unknown) {
  vi.mocked(global.fetch).mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
    headers: { get: vi.fn().mockReturnValue(null) },
  } as unknown as Response);
}

describe('CrUX: originLoadingExperience does NOT overwrite URL-level headline verdict (🟡)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PAGESPEED_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('URL-level FAST verdict is preserved when originLoadingExperience is SLOW', async () => {
    // This is the key scenario: URL-level (the page) is fast, origin (the whole domain) is slow.
    // The headline verdict that drives P2-07 and the UI must come from loadingExperience ('FAST'),
    // NOT from originLoadingExperience ('SLOW').
    mockFetchOk(
      makeResponseWithBothBlocks({ urlCategory: 'FAST', originCategory: 'SLOW' }),
    );

    const metrics = await runLighthouse('https://example.com');

    // URL-level field data (fieldData) must reflect 'FAST'
    expect(metrics.fieldData).not.toBeNull();
    expect(metrics.fieldData!.overallCategory).toBe('FAST');

    // Origin-level field data (originFieldData) must reflect 'SLOW'
    expect(metrics.originFieldData).not.toBeNull();
    expect(metrics.originFieldData!.overallCategory).toBe('SLOW');

    // The origin verdict must NOT contaminate the URL-level verdict
    expect(metrics.fieldData!.overallCategory).not.toBe('SLOW');
  });

  it('URL-level SLOW verdict is preserved when originLoadingExperience is FAST', async () => {
    // Reverse scenario: the specific URL is slow even though the origin/domain is fast overall.
    // The URL-level SLOW verdict must drive P2-07's HIGH finding.
    mockFetchOk(
      makeResponseWithBothBlocks({ urlCategory: 'SLOW', originCategory: 'FAST' }),
    );

    const metrics = await runLighthouse('https://example.com');

    // URL-level field data (fieldData) must reflect 'SLOW'
    expect(metrics.fieldData!.overallCategory).toBe('SLOW');

    // Origin-level (originFieldData) must reflect 'FAST'
    expect(metrics.originFieldData!.overallCategory).toBe('FAST');

    // The URL-level verdict must NOT be overwritten by the origin FAST
    expect(metrics.fieldData!.overallCategory).not.toBe('FAST');
  });

  it('fieldData and originFieldData are independent objects (not the same reference)', async () => {
    // The two parsed blocks must be fully independent — a mutation to one
    // must not affect the other.
    mockFetchOk(
      makeResponseWithBothBlocks({ urlCategory: 'AVERAGE', originCategory: 'SLOW' }),
    );

    const metrics = await runLighthouse('https://example.com');

    expect(metrics.fieldData).not.toBe(metrics.originFieldData); // different references
    expect(metrics.fieldData!.overallCategory).toBe('AVERAGE');
    expect(metrics.originFieldData!.overallCategory).toBe('SLOW');
  });

  it('fieldData is null when loadingExperience is absent, even if originLoadingExperience is present', async () => {
    // If the URL-level block is missing, fieldData must be null.
    // The origin block being present must NOT fill in fieldData.
    mockFetchOk({
      lighthouseResult: {
        categories: { performance: { score: 0.80 }, accessibility: { score: 0.90 }, seo: { score: 0.95 } },
        audits: {
          'largest-contentful-paint': { numericValue: 2400 },
          'first-contentful-paint': { numericValue: 1200 },
          'cumulative-layout-shift': { numericValue: 0.07 },
          'total-blocking-time': { numericValue: 200 },
          'interactive': { numericValue: 3500 },
          'speed-index': { numericValue: 3000 },
          'server-response-time': { numericValue: 300 },
        },
      },
      // NO loadingExperience (URL-level block absent)
      originLoadingExperience: {
        overall_category: 'SLOW',
        metrics: {
          LARGEST_CONTENTFUL_PAINT_MS: { percentile: 4500, category: 'SLOW', distributions: [] },
        },
      },
    });

    const metrics = await runLighthouse('https://example.com');

    // fieldData must be null — the URL-level block was absent
    expect(metrics.fieldData).toBeNull();

    // originFieldData is populated from the origin block
    expect(metrics.originFieldData).not.toBeNull();
    expect(metrics.originFieldData!.overallCategory).toBe('SLOW');
  });
});

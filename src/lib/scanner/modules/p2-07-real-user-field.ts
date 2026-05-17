/**
 * P2-07: Real-User Field Experience
 * Phase 5.5: Performance Scanning
 *
 * Emits findings based on Google CrUX field data (real-user measurements)
 * from the PageSpeed Insights API, surfacing cases where real users are
 * experiencing slow performance even when the lab Lighthouse score looks acceptable.
 *
 * Fire predicate for HIGH severity (both conditions must be true):
 *   1. URL-level fieldData.overallCategory === 'SLOW'  (real users on this URL are slow)
 *   2. Lab performanceScore >= 0.50  (lab test doesn't catch it — divergence)
 *
 * Rationale: a HIGH finding is only warranted when the lab gives a false sense of
 * security (score >= 50) but real users are suffering (SLOW). If the lab also
 * agrees the site is slow, the existing P2-01 findings already cover it — there
 * is no need to double-alert. The threshold 0.50 on a 0–1 scale maps to 50 out of
 * 100 on the Lighthouse UI, which is Google's boundary for the "red" zone.
 *
 * When only origin-level data is available (no URL-level), we emit at most an
 * INFO finding. Origin data is an aggregate across all pages of the site and does
 * not reliably characterise the specific URL being scanned, so a HIGH is never
 * justified from it.
 *
 * When no field data at all is present (common for low-traffic URLs), we emit
 * nothing — "no data" noise is explicitly prohibited by the task contract.
 */

import type { RawFinding } from '../types';
import type { LighthouseMetrics, CrUXFieldData } from '../lighthouse';

// Maximum length for any untrusted string echoed into a finding.
// CrUX data comes from Google, but the scanned URL is attacker-controlled and
// could contain excessively long strings. Cap at 200 chars.
const MAX_TEXT_LEN = 200;

function clamp(s: string): string {
  if (s.length <= MAX_TEXT_LEN) return s;
  return s.slice(0, MAX_TEXT_LEN) + '…';
}

/**
 * Format one CrUX metric line for use in evidence, or a dash when null.
 * Uses the parsed `category` (FAST / AVERAGE / SLOW) and `percentile` (p75).
 * For CLS the percentile is already normalised to the true decimal by lighthouse.ts
 * (÷100 applied there); we display it as-is.
 */
function fmtMetric(
  name: string,
  metric: CrUXFieldData['lcp'], // any CrUXMetric | null
  unit: string,
): string {
  if (!metric) return `${name}: no data`;
  const p75 = unit === '' ? metric.percentile.toFixed(3) : Math.round(metric.percentile);
  return `${name} p75=${p75}${unit} (${metric.category})`;
}

/**
 * Build a short evidence string from a CrUXFieldData block.
 * Only includes the metrics that are present; omits absent ones.
 */
function buildEvidence(field: CrUXFieldData): string {
  const lines: string[] = [
    `Overall: ${field.overallCategory}`,
  ];
  if (field.lcp) lines.push(fmtMetric('LCP', field.lcp, 'ms'));
  if (field.inp) lines.push(fmtMetric('INP', field.inp, 'ms'));
  if (field.cls) lines.push(fmtMetric('CLS', field.cls, ''));  // CLS is unitless
  if (field.fcp) lines.push(fmtMetric('FCP', field.fcp, 'ms'));
  if (field.ttfb) lines.push(fmtMetric('TTFB', field.ttfb, 'ms'));
  return clamp(lines.join(' | '));
}

export function runRealUserFieldModule(metrics: LighthouseMetrics): RawFinding[] {
  const findings: RawFinding[] = [];

  const urlField = metrics.fieldData ?? null;
  const originField = metrics.originFieldData ?? null;

  // --- Case 1: URL-level field data present ---
  if (urlField !== null) {
    // Only HIGH when URL is SLOW *and* lab score says ≥ 50 (divergence scenario).
    // Lab performanceScore is 0–1; we treat >= 0.50 as "acceptable lab score".
    // If lab score is null we cannot determine divergence, so we downgrade to INFO.
    const labScore = metrics.performanceScore ?? null;
    const labAcceptable = labScore !== null && labScore >= 0.5;

    if (urlField.overallCategory === 'SLOW' && labAcceptable) {
      findings.push({
        moduleId: 'P2-07',
        severity: 'HIGH',
        category: 'Performance',
        title: 'Real users are experiencing slow performance (CrUX field data)',
        location: 'Real-User Field Experience',
        evidence: buildEvidence(urlField),
        explanation:
          'Google Chrome User Experience Report (CrUX) shows that real visitors to this ' +
          'URL are rated SLOW, even though the Lighthouse lab score is ≥ 50. ' +
          'Lab tests run under controlled conditions and may miss real-world factors such as ' +
          'slower devices, geographic latency, third-party scripts, or A/B variants. ' +
          'CrUX data is collected from millions of real Chrome users and is a more reliable ' +
          'signal of actual user experience. This divergence is a strong indicator that ' +
          'lab optimizations alone have not reached real users.',
        impact:
          'Google uses CrUX field data — not lab scores — as the primary input for the ' +
          'Core Web Vitals ranking signal in Search. A SLOW field-data rating will suppress ' +
          'search rankings even if your Lighthouse score looks healthy. Real users are ' +
          'experiencing poor load times, which typically increases bounce rates and reduces conversions.',
        fixManual: [
          'Profile the page on real devices (Android Chrome) using Chrome DevTools remote debugging',
          'Check if third-party scripts (analytics, chat widgets, ads) are loading lazily',
          'Verify CDN coverage — measure TTFB from regions where your users are located',
          'Test on slow mobile connections (Slow 3G throttling) to replicate CrUX conditions',
          'Compare lab run vs field data per-metric: identify which specific metric is SLOW in CrUX',
          'Use Search Console "Core Web Vitals" report for URL-group-level field data over time',
        ],
        fixAiPrompt:
          `Real users rate this page as SLOW (CrUX field data) despite a Lighthouse lab score ` +
          `of ${labScore !== null ? Math.round(labScore * 100) : 'unknown'}. ` +
          `Help me find the gap between lab performance and real-user experience. ` +
          `Investigate third-party scripts, CDN latency, device-speed variation, and A/B variants.`,
      });
    } else if (urlField.overallCategory === 'SLOW' && !labAcceptable) {
      // URL is SLOW but lab also agrees it's slow (score < 50 or null).
      // P2-01 already covers this; emit INFO so the field data is still visible in the
      // report without double-penalising. This is transparency, not a new penalty.
      findings.push({
        moduleId: 'P2-07',
        severity: 'INFO',
        category: 'Performance',
        title: 'CrUX field data confirms slow real-user experience',
        location: 'Real-User Field Experience',
        evidence: buildEvidence(urlField),
        explanation:
          'Both the Lighthouse lab score and real-user CrUX data indicate slow performance. ' +
          'This confirms the performance issues detected by the lab test are being felt ' +
          'by actual users. Addressing the performance findings in P2-01 will improve both ' +
          'the lab score and real-user experience.',
        impact:
          'Google ranks pages using CrUX field data for Core Web Vitals; confirmed slow ' +
          'field data will suppress search rankings.',
        fixManual: [
          'Address the performance findings flagged by the Core Web Vitals module (P2-01)',
          'Monitor CrUX data in Google Search Console after deploying fixes — field data ' +
          'typically updates within 28 days',
        ],
        fixAiPrompt:
          'Both lab and real-user data show slow performance. Focus on the P2-01 Core Web ' +
          'Vitals findings first — fixing them should improve both the lab score and field data.',
      });
    } else if (urlField.overallCategory === 'AVERAGE') {
      // URL is AVERAGE — surfaced as INFO for transparency; no penalty.
      findings.push({
        moduleId: 'P2-07',
        severity: 'INFO',
        category: 'Performance',
        title: 'Real users rate this page as needing improvement (CrUX field data)',
        location: 'Real-User Field Experience',
        evidence: buildEvidence(urlField),
        explanation:
          'CrUX field data shows real users rate this page as AVERAGE (needs improvement). ' +
          'The page is not in the SLOW band, but there is room to reach the FAST threshold ' +
          'and improve Core Web Vitals rankings.',
        impact:
          'Pages rated AVERAGE by CrUX will not receive the "Good" Core Web Vitals badge ' +
          'in Google Search and may rank below FAST competitors.',
        fixManual: [
          'Review individual metric verdicts to find which CWV is pulling the overall ' +
          'category to AVERAGE',
          'Target the metric closest to the FAST threshold for the highest return on effort',
        ],
        fixAiPrompt:
          'CrUX field data rates this page as AVERAGE. Help me identify which Core Web ' +
          'Vital to improve to reach the FAST threshold.',
      });
    }
    // overallCategory === 'FAST': no finding (the URL is performing well for real users)

    return findings;
  }

  // --- Case 2: Only origin-level data (no URL-level) ---
  // Origin data is less precise; never emit HIGH from it. At most INFO.
  if (originField !== null) {
    if (originField.overallCategory === 'SLOW') {
      findings.push({
        moduleId: 'P2-07',
        severity: 'INFO',
        category: 'Performance',
        title: 'Origin-level CrUX data indicates slow real-user experience',
        location: 'Real-User Field Experience',
        evidence: `[Origin-level data — not URL-specific] ${buildEvidence(originField)}`,
        explanation:
          'URL-specific CrUX data is unavailable (the URL may have low traffic). ' +
          'The origin-level data (aggregated across all pages of this domain) shows a ' +
          'SLOW overall category. This is an indicator — not a confirmed verdict for this ' +
          'specific URL — that the site as a whole may have real-user performance issues.',
        impact:
          'If origin-level CrUX is SLOW, some pages on this domain are likely performing ' +
          'poorly for real users. This may affect Core Web Vitals rankings across the site.',
        fixManual: [
          'Check Google Search Console for per-URL field data and identify slow pages',
          'Address site-wide performance issues (shared JS bundles, fonts, third-party scripts)',
        ],
        fixAiPrompt:
          'Origin-level CrUX data shows the site is rated SLOW overall. Help me identify ' +
          'site-wide performance issues that could be causing this.',
      });
    }
    // AVERAGE or FAST origin-only: too imprecise to surface; no finding.

    return findings;
  }

  // --- Case 3: No field data at all ---
  // Explicitly emit nothing. "No data" noise is prohibited.
  return findings;
}

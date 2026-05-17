/**
 * P2-08: Web Best Practices
 * Phase 5.5: Performance / Best-Practices Scanning
 *
 * Maps the parsed Lighthouse best-practices audit failures stored in
 * LighthouseMetrics.bestPracticesIssues into RawFinding[] with
 * category 'Best Practices' and moduleId 'P2-08'.
 *
 * Design decisions:
 * 1. Tolerant: returns [] when bestPracticesIssues is absent, null, or empty.
 *    Never throws on missing fields.
 * 2. Severity mapping: Lighthouse best-practices audits don't carry inherent
 *    severity grades. We use a simple heuristic: if the audit score is 0
 *    (complete failure) → MEDIUM; if between 0 and 1 (partial failure) → LOW.
 *    INFO is used for purely informational items. This keeps findings
 *    proportionate and avoids false HIGH/CRITICAL signals.
 * 3. Length caps on untrusted text: audit title, description, and displayValue
 *    all originate from the Lighthouse result, which in turn comes from the
 *    scanned URL's page. Cap echoed strings at MAX_TEXT_LEN chars.
 * 4. No findings are invented: we only forward what Lighthouse already
 *    determined was a failure (score < 1, score !== null).
 */

import type { RawFinding } from '../types';
import type { LighthouseMetrics } from '../lighthouse';
import type { ParsedAudit } from '../audit-parser';

// Maximum length for any untrusted string echoed into a finding.
const MAX_TEXT_LEN = 300;

function clamp(s: string | undefined | null): string {
  if (!s) return '';
  if (s.length <= MAX_TEXT_LEN) return s;
  return s.slice(0, MAX_TEXT_LEN) + '…';
}

/**
 * Map a ParsedAudit score to a finding severity.
 * Score is the Lighthouse 0–1 numeric score.
 * - Score 0: complete failure → MEDIUM
 * - Score 0 < x < 1: partial failure → LOW
 * - Score null: should not reach here (filtered before calling), but guard → LOW
 */
function mapSeverity(score: number | null): RawFinding['severity'] {
  if (score === null) return 'LOW';
  if (score === 0) return 'MEDIUM';
  return 'LOW'; // partial pass (0 < score < 1)
}

/**
 * Convert one failed best-practices audit into a RawFinding.
 * Never throws — all field accesses are guarded.
 */
function auditToFinding(audit: ParsedAudit): RawFinding {
  const severity = mapSeverity(audit.score);

  // Build evidence string from the audit's displayValue or score.
  // displayValue is already Lighthouse's human-readable summary (e.g. "1 error").
  const scoreDisplay = audit.score !== null ? `score=${audit.score.toFixed(2)}` : 'score=failed';
  const evidence = audit.displayValue
    ? clamp(`${audit.displayValue} (${scoreDisplay})`)
    : scoreDisplay;

  // Use the audit description as the explanation; it comes from Lighthouse docs.
  const explanation = clamp(audit.description) ||
    `Lighthouse audit '${clamp(audit.id)}' did not pass.`;

  return {
    moduleId: 'P2-08',
    severity,
    category: 'Best Practices',
    title: clamp(audit.title) || `Best practices issue: ${clamp(audit.id)}`,
    location: `Lighthouse audit: ${clamp(audit.id)}`,
    evidence,
    explanation,
    impact:
      'Failing best-practices audits can indicate security issues, browser ' +
      'compatibility problems, deprecated APIs, or development errors that ' +
      'negatively affect user experience and maintainability.',
    fixManual: [
      `Review the '${clamp(audit.id)}' Lighthouse audit in your browser DevTools ` +
        'Lighthouse panel for specific failing elements.',
      'Consult the Lighthouse documentation for remediation guidance: ' +
        'https://developer.chrome.com/docs/lighthouse/best-practices/',
    ],
    fixAiPrompt:
      `My site fails the Lighthouse best-practices audit '${clamp(audit.id)}'. ` +
      (audit.displayValue ? `Current result: ${clamp(audit.displayValue)}. ` : '') +
      'Help me understand why this audit fails and how to fix it.',
  };
}

export function runBestPracticesModule(metrics: LighthouseMetrics): RawFinding[] {
  // Tolerant: treat absent/null/empty array as "nothing to report".
  const issues = metrics.bestPracticesIssues;
  if (!issues || issues.length === 0) return [];

  const findings: RawFinding[] = [];

  for (const audit of issues) {
    // Guard: skip any item that is not a valid object (defensive — should not occur
    // because the lighthouse.ts parser already filters these, but belt-and-suspenders).
    if (!audit || typeof audit !== 'object') continue;

    findings.push(auditToFinding(audit));
  }

  return findings;
}

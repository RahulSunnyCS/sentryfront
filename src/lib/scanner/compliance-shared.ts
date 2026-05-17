/**
 * compliance-shared.ts — Single source of truth for shared compliance constants
 * and the signal-derivation function used across compliance.ts and any UI
 * components (report-view.tsx, print-report.tsx) that need to re-derive a signal
 * from a raw finding without re-running the full orchestrator.
 *
 * Design constraints:
 * - Pure functions and plain constants only — no Node-only imports, no 'use server',
 *   no side-effects. This file must be safely importable from both server (compliance.ts)
 *   and client (React components) without requiring special bundler treatment.
 * - Derivation logic is byte-equivalent to the rule previously inlined in compliance.ts.
 *   This is a refactor, NOT a behaviour change.
 */

import type { RawFinding } from './types';

// ── Fail-closed keyword list ─────────────────────────────────────────────────

/**
 * Lowercase substrings that, when found in an INFO finding's title, indicate
 * that the module was unable to evaluate the signal (e.g. headless unavailable,
 * not applicable to the page type). These always map to 'not-evaluated' rather
 * than 'observed' so the system is conservative on the regulatory claim surface.
 *
 * IMPORTANT: any change to this list changes reported compliance signals across
 * every P5 module. Review carefully and update tests before modifying.
 */
export const FAIL_CLOSED_KEYWORDS: readonly string[] = [
  'not evaluated',
  'unavailable',
  'not applicable',
] as const;

// ── Derivation function ──────────────────────────────────────────────────────

/**
 * Derive a ComplianceSignal status from a single RawFinding.
 *
 * Rule (applied uniformly across all P5 findings):
 *   - severity INFO  AND title contains any FAIL_CLOSED_KEYWORD → 'not-evaluated'
 *   - severity INFO  AND does NOT contain those terms             → 'observed'
 *   - severity LOW / MEDIUM / HIGH / CRITICAL                    → 'not-observed'
 *
 * The logic is intentionally string-based rather than structural (module-id
 * switch statements) so future P5 modules are handled automatically without
 * changes here — any module that follows the fail-closed INFO pattern works.
 *
 * The function is intentionally conservative: when in doubt, 'not-evaluated'
 * is used rather than 'not-observed', because a false-negative on a regulatory
 * claim surface is lower-risk than a false positive.
 */
export function deriveComplianceStatus(
  finding: RawFinding,
): 'observed' | 'not-observed' | 'not-evaluated' {
  if (finding.severity === 'INFO') {
    const titleLower = finding.title.toLowerCase();
    // Fail-closed and unavailable paths always use neutral 'not-evaluated'.
    // We check for the key phrases the P5 modules use in their INFO titles.
    if (FAIL_CLOSED_KEYWORDS.some((kw) => titleLower.includes(kw))) {
      return 'not-evaluated';
    }
    // Any other INFO = a positive observation (e.g. "Consent mechanism observed",
    // "Privacy policy link observed", "No third-party...observed" also qualifies
    // as a positive signal because it means the footprint was clean).
    return 'observed';
  }
  // LOW / MEDIUM / HIGH / CRITICAL findings represent negative signals —
  // something is absent, misconfigured, or concerning.
  return 'not-observed';
}

// ── Framework routing ────────────────────────────────────────────────────────

/**
 * Map a module ID to the frameworks whose summary it contributes to.
 * A module may contribute to more than one framework (e.g. P5-01 is relevant
 * to both GDPR and CCPA because both frameworks have consent/notice provisions).
 *
 * Rationale for multi-framework contribution:
 * - GDPR and CCPA share many surface indicators (consent banners, privacy
 *   policy, data-subject rights) — it would be misleading to attribute them
 *   to only one framework when the passive scan cannot determine jurisdiction.
 * - WCAG / Accessibility is separate: only P5-04 speaks to it directly.
 */
export const MODULE_FRAMEWORKS: Record<string, string[]> = {
  'P5-01': ['GDPR', 'CCPA'],          // cookie consent is relevant to both frameworks
  'P5-02': ['GDPR', 'CCPA'],          // privacy policy disclosure required by both
  'P5-03': ['GDPR'],                  // data-protection headers are a GDPR technical measure
  'P5-04': ['WCAG / Accessibility'],  // WCAG attestation — not a GDPR/CCPA signal
  'P5-05': ['GDPR', 'CCPA'],          // third-party sharing disclosure required by both
  'P5-06': ['GDPR', 'CCPA'],          // data-subject rights affordances required by both
};

// ── Framework display order ──────────────────────────────────────────────────

/**
 * Stable display order for the framework summary. The orchestrator uses this to
 * sort the frameworkSummary array; any framework not in this list is appended at
 * the end (future-proofing for new frameworks).
 */
export const FRAMEWORK_ORDER: readonly string[] = [
  'GDPR',
  'CCPA',
  'WCAG / Accessibility',
] as const;

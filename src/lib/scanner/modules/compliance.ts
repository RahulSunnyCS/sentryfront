/**
 * Compliance Scanning Orchestrator
 * Phase 5: Privacy & Compliance Checks
 *
 * Coordinates all compliance detection modules (P5-01 to P5-06) and builds
 * a per-framework signal summary (GDPR, CCPA, WCAG / Accessibility).
 *
 * IMPORTANT — regulatory claim surface:
 * This module aggregates factual, observable signals from passive DOM/header
 * inspection. It must never compute a score, a fraction, a pass-rate, or
 * any numeric representation of compliance. Each signal is one of:
 *   'observed'     — the feature/affordance was positively detected
 *   'not-observed' — the feature was absent from the crawled surface
 *   'not-evaluated'— evaluation was skipped or not possible (fail-closed)
 *
 * Signal derivation rule (applied uniformly across all P5 findings):
 *   - severity INFO  AND title contains 'not evaluated' / 'unavailable'
 *                 → 'not-evaluated'
 *   - severity INFO  AND does NOT contain those terms (positive detection)
 *                 → 'observed'
 *   - severity LOW / MEDIUM / HIGH / CRITICAL (negative signal)
 *                 → 'not-observed'
 *
 * This rule is intentionally conservative: when in doubt, 'not-evaluated'
 * is used rather than 'not-observed', because a false-negative on a
 * regulatory claim surface is lower-risk than a false positive.
 */

import type { CrawlResult, ComplianceContext, ComplianceResult, ComplianceFrameworkSummary, ComplianceSignal } from '../types';
import type { RawFinding } from '../types';
import { runCookieConsentModule } from './p5-01-cookie-consent';
import { runPrivacyPolicyModule } from './p5-02-privacy-policy';
import { runDataProtectionHeadersModule } from './p5-03-data-protection-headers';
import { runWcagAttestationModule } from './p5-04-wcag-attestation';
import { runThirdPartyDataSharingModule } from './p5-05-third-party-sharing';
import { runUserRightsModule } from './p5-06-user-rights';
import { logger } from '@/lib/logger';

// ── Signal derivation ────────────────────────────────────────────────────────

/**
 * Derive a ComplianceSignal status from a single RawFinding.
 *
 * The derivation logic is intentionally string-based rather than structural
 * (module-id specific switch statements) so that future P5 modules do not
 * require changes here — any module that follows the fail-closed INFO pattern
 * is handled automatically.
 */
function deriveStatus(finding: RawFinding): ComplianceSignal['status'] {
  if (finding.severity === 'INFO') {
    const titleLower = finding.title.toLowerCase();
    // Fail-closed and unavailable paths always use neutral 'not-evaluated'.
    // We check for the key phrases the P5 modules use in their INFO titles.
    if (
      titleLower.includes('not evaluated') ||
      titleLower.includes('unavailable') ||
      titleLower.includes('not applicable')
    ) {
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

// ── Per-module signal label extraction ──────────────────────────────────────

/**
 * Produce a short human-readable signal label from a finding.
 * We use the finding title directly — modules already write concise titles.
 * Truncate if exceptionally long to keep the summary UI clean.
 */
function signalLabel(finding: RawFinding): string {
  return finding.title.length <= 80
    ? finding.title
    : finding.title.slice(0, 77) + '…';
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
const MODULE_FRAMEWORKS: Record<string, string[]> = {
  'P5-01': ['GDPR', 'CCPA'],          // cookie consent is relevant to both frameworks
  'P5-02': ['GDPR', 'CCPA'],          // privacy policy disclosure required by both
  'P5-03': ['GDPR'],                  // data-protection headers are a GDPR technical measure
  'P5-04': ['WCAG / Accessibility'],  // WCAG attestation — not a GDPR/CCPA signal
  'P5-05': ['GDPR', 'CCPA'],          // third-party sharing disclosure required by both
  'P5-06': ['GDPR', 'CCPA'],          // data-subject rights affordances required by both
};

// ── Module runner helpers ────────────────────────────────────────────────────

/**
 * Run a single compliance sub-module in an isolated try/catch.
 * On any thrown exception the module is skipped and zero findings are returned
 * so the rest of the group continues unaffected.
 *
 * @param moduleId  - Human-readable id for error context (e.g. 'P5-01')
 * @param run       - The synchronous module function to invoke
 * @param crawl     - Forwarded CrawlResult
 * @param ctx       - Forwarded ComplianceContext
 */
function safeRun(
  moduleId: string,
  run: (crawl: CrawlResult, ctx: ComplianceContext) => RawFinding[],
  crawl: CrawlResult,
  ctx: ComplianceContext,
): RawFinding[] {
  try {
    return run(crawl, ctx);
  } catch (error) {
    // Log the error but do not re-throw — this module's failure is isolated.
    logger.error(`Compliance module ${moduleId} threw an unexpected error`, { moduleId }, error instanceof Error ? error : undefined);
    return [];
  }
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Run all compliance modules and return aggregated findings plus the
 * non-numeric per-framework signal summary.
 *
 * The function signature is async to match the convention of the sibling
 * orchestrators (accessibility.ts, seo.ts). The compliance modules themselves
 * are synchronous; the async wrapper means index.ts can call this uniformly
 * with await / Promise.all without special-casing.
 */
export async function runComplianceModules(
  crawl: CrawlResult,
  ctx: ComplianceContext,
): Promise<ComplianceResult> {
  logger.info('Running compliance scan', { url: crawl.finalUrl });

  // Invoke each module in its own isolated try/catch via safeRun.
  // Sequential execution is used here (not Promise.all) because all modules
  // are synchronous CPU-bound functions — parallelism via Promise.all would
  // only add overhead from microtask scheduling with no I/O gain.
  const cookieConsentFindings = safeRun('P5-01', runCookieConsentModule, crawl, ctx);
  const privacyPolicyFindings = safeRun('P5-02', runPrivacyPolicyModule, crawl, ctx);
  const dataProtectionFindings = safeRun('P5-03', runDataProtectionHeadersModule, crawl, ctx);
  const wcagAttestationFindings = safeRun('P5-04', runWcagAttestationModule, crawl, ctx);
  const thirdPartySharingFindings = safeRun('P5-05', runThirdPartyDataSharingModule, crawl, ctx);
  const userRightsFindings = safeRun('P5-06', runUserRightsModule, crawl, ctx);

  // Aggregate all findings into a single flat array for the RawFinding pipeline.
  const findings: RawFinding[] = [
    ...cookieConsentFindings,
    ...privacyPolicyFindings,
    ...dataProtectionFindings,
    ...wcagAttestationFindings,
    ...thirdPartySharingFindings,
    ...userRightsFindings,
  ];

  // ── Build the framework summary ────────────────────────────────────────────
  //
  // Group findings by framework using the MODULE_FRAMEWORKS map.
  // Each finding becomes exactly one signal per framework it is attributed to.
  // No score, count, fraction, or percentage is computed anywhere.

  // Accumulate signals per framework name.
  const frameworkSignals = new Map<string, ComplianceSignal[]>();

  // Ensure all three framework headings appear even when a module produced no
  // findings (e.g. safeRun returned [] due to an error). This prevents the UI
  // from silently omitting a framework section.
  for (const frameworks of Object.values(MODULE_FRAMEWORKS)) {
    for (const fw of frameworks) {
      if (!frameworkSignals.has(fw)) {
        frameworkSignals.set(fw, []);
      }
    }
  }

  // Map each finding to its framework(s) and derive the signal status.
  for (const finding of findings) {
    const frameworks = MODULE_FRAMEWORKS[finding.moduleId];
    if (!frameworks) continue; // unknown module id — skip silently

    const status = deriveStatus(finding);
    const label = signalLabel(finding);

    for (const fw of frameworks) {
      const signals = frameworkSignals.get(fw);
      if (signals) {
        signals.push({ label, status });
      }
    }
  }

  // Convert the Map to the typed ComplianceFrameworkSummary array.
  // Preserve a stable output order: GDPR → CCPA → WCAG / Accessibility.
  const FRAMEWORK_ORDER = ['GDPR', 'CCPA', 'WCAG / Accessibility'];
  const frameworkSummary: ComplianceFrameworkSummary = FRAMEWORK_ORDER
    .filter((fw) => frameworkSignals.has(fw))
    .map((fw) => ({
      framework: fw,
      signals: frameworkSignals.get(fw)!,
    }));

  // Include any framework not in FRAMEWORK_ORDER at the end (future-proofing).
  for (const [fw, signals] of frameworkSignals.entries()) {
    if (!FRAMEWORK_ORDER.includes(fw)) {
      frameworkSummary.push({ framework: fw, signals });
    }
  }

  logger.info('Compliance scan completed', {
    url: crawl.finalUrl,
    findingsCount: findings.length,
    frameworkCount: frameworkSummary.length,
  });

  return { findings, frameworkSummary };
}

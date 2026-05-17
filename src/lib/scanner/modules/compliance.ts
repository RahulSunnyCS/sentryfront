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
import * as cheerio from 'cheerio';
import { deriveComplianceStatus, MODULE_FRAMEWORKS, FRAMEWORK_ORDER } from '../compliance-shared';

// ── Signal derivation ────────────────────────────────────────────────────────
//
// deriveComplianceStatus is the single source of truth, defined in
// compliance-shared.ts. It is imported above and called directly wherever
// the previous local deriveStatus was used. The alias below keeps the internal
// call sites readable without a rename diff across the file.
const deriveStatus = (finding: RawFinding): ComplianceSignal['status'] =>
  deriveComplianceStatus(finding);

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
//
// MODULE_FRAMEWORKS and FRAMEWORK_ORDER are imported from compliance-shared.ts
// (the single source of truth). They are also re-exported implicitly via the
// import above so UI components can import from compliance-shared.ts directly
// without going through this server-side orchestrator.

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

  // ── C2: Parse-once optimisation ──────────────────────────────────────────────
  //
  // Each P5 module previously called cheerio.load() independently, producing up
  // to 6 separate parse passes over the same HTML document. Instead, we select
  // the best available HTML representation once here and parse it a single time.
  // The resulting CheerioAPI is forwarded to every module via ctx.dom; all
  // modules implement the `ctx.dom ?? cheerio.load(...)` pattern (FIX-01) so
  // they use the shared instance when present and fall back gracefully when not.
  //
  // Preference order matches each module's own selection logic:
  //   cleanedHtml  — noise-reduced (scripts/styles stripped), sourced from
  //                  renderedHtml when available — preferred for DOM inspection.
  //   renderedHtml — post-JS snapshot from Playwright.
  //   html         — raw pre-JS fetch-only HTML.
  //
  // Guard: if the selected source is absent or effectively empty we do NOT set
  // ctx.dom so the modules' own fail-closed paths (which check for empty HTML)
  // continue to work correctly without receiving a cheerio instance built from
  // an empty string.
  const htmlForDom = crawl.cleanedHtml ?? crawl.renderedHtml ?? crawl.html;
  const ctxWithDom: ComplianceContext =
    htmlForDom && htmlForDom.trim().length > 0
      ? { ...ctx, dom: cheerio.load(htmlForDom) }
      : ctx; // leave ctx.dom absent so modules' fail-closed paths still fire

  // Invoke each module in its own isolated try/catch via safeRun.
  // Sequential execution is used here (not Promise.all) because all modules
  // are synchronous CPU-bound functions — parallelism via Promise.all would
  // only add overhead from microtask scheduling with no I/O gain.
  const cookieConsentFindings = safeRun('P5-01', runCookieConsentModule, crawl, ctxWithDom);
  const privacyPolicyFindings = safeRun('P5-02', runPrivacyPolicyModule, crawl, ctxWithDom);
  const dataProtectionFindings = safeRun('P5-03', runDataProtectionHeadersModule, crawl, ctxWithDom);
  const wcagAttestationFindings = safeRun('P5-04', runWcagAttestationModule, crawl, ctxWithDom);
  const thirdPartySharingFindings = safeRun('P5-05', runThirdPartyDataSharingModule, crawl, ctxWithDom);
  const userRightsFindings = safeRun('P5-06', runUserRightsModule, crawl, ctxWithDom);

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
  // Preserve a stable output order using FRAMEWORK_ORDER from compliance-shared.ts
  // (the single source of truth imported at the top of this file). Previously a
  // local `const FRAMEWORK_ORDER` was declared here, which shadowed the import
  // and prevented the shared constant from being used — now both sites reference
  // the same value, so the display order is guaranteed to be in sync.
  const frameworkSummary: ComplianceFrameworkSummary = (FRAMEWORK_ORDER as string[])
    .filter((fw) => frameworkSignals.has(fw))
    .map((fw) => ({
      framework: fw,
      signals: frameworkSignals.get(fw)!,
    }));

  // Include any framework not in FRAMEWORK_ORDER at the end (future-proofing).
  for (const [fw, signals] of frameworkSignals.entries()) {
    if (!(FRAMEWORK_ORDER as string[]).includes(fw)) {
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

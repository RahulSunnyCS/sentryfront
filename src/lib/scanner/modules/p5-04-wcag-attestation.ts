/**
 * P5-04 — WCAG Attestation Signal
 *
 * Emits a factual, claim-safe signal about the site's accessibility
 * measurement surface. This module is intentionally fail-closed: any
 * ambiguity in the score input (missing, zero, or sourced from an
 * unavailable pass) produces a neutral INFO finding rather than a
 * compliance verdict, because this is a regulatory-claim surface.
 *
 * IMPORTANT: This module must never assert WCAG 2.2 AA compliance,
 * ADA compliance, or any equivalent legal attestation. It surfaces
 * Lighthouse-subset data as a signal only, with explicit limitations
 * stated inline.
 */

import * as cheerio from 'cheerio';
import type { CrawlResult, RawFinding, ComplianceContext } from '../types';

/**
 * Strip the query string and fragment from a scanned-site href before it is
 * written into finding evidence or location. Query strings may contain PII
 * (tokens, email addresses, session identifiers) that must not appear in scan output.
 *
 * Uses URL() with the page's finalUrl as base so relative hrefs resolve. Falls
 * back to a simple string-split on '?' / '#' when parsing fails.
 */
function stripQueryAndFragment(href: string, base: string): string {
  if (!href) return href;
  try {
    const u = new URL(href, base);
    return u.origin + u.pathname;
  } catch {
    const qi = href.indexOf('?');
    const hi = href.indexOf('#');
    const cut = qi === -1 ? hi : hi === -1 ? qi : Math.min(qi, hi);
    return cut === -1 ? href : href.slice(0, cut);
  }
}

// Regex matches link text or href patterns associated with accessibility
// statements. Intentionally broad — presence detection only.
const A11Y_STATEMENT_RE = /accessibility[- ]?statement|accessibility/i;
const A11Y_HREF_RE = /accessibility/i;

/**
 * Detect whether the page includes any link that plausibly points to an
 * accessibility statement. Uses cleanedHtml first (noise-reduced), falls
 * back through renderedHtml to raw html.
 *
 * Returns the href string (query/fragment stripped) if found, null otherwise.
 */
function detectAccessibilityStatementLink(
  crawl: CrawlResult,
  ctx: ComplianceContext,
): string | null {
  // Prefer the noise-reduced version; fall through to rendered then raw HTML.
  const source = crawl.cleanedHtml ?? crawl.renderedHtml ?? crawl.html;
  if (!source) return null;

  // Use the orchestrator-supplied pre-parsed DOM when available to avoid
  // re-parsing the same HTML that other P5 modules have already parsed.
  const $ = ctx.dom ?? cheerio.load(source);
  let found: string | null = null;

  $('a').each((_i, el) => {
    if (found) return; // cheerio doesn't support early break — guard instead
    const anchor = $(el);
    const href = (anchor.attr('href') ?? '').trim();
    const text = anchor.text().trim();

    // Match on anchor text OR href — presence detection, not content validation.
    if (A11Y_STATEMENT_RE.test(text) || A11Y_HREF_RE.test(href)) {
      // Strip query string and fragment before storing — query params can carry
      // PII (tokens, email addresses). Use '(no href)' sentinel when href is empty.
      const rawHref = href || '';
      found = rawHref ? stripQueryAndFragment(rawHref, crawl.finalUrl) : '(no href)';
    }
  });

  return found;
}

/**
 * Determine whether the ctx carries a genuine, usable accessibility score.
 *
 * A score is considered unusable when:
 *   - accessibilityScore is undefined (Lighthouse never ran or result lost)
 *   - accessibilityScoreSource is 'unavailable' (accessibility pass caught
 *     an error and deliberately marked its output as unavailable)
 *   - accessibilityScore === 0 (treat as "caught failure" — a real score of
 *     0/100 is theoretically possible but indistinguishable from a failed run
 *     that returned 0; we fail-closed to avoid a false "0/100 compliance risk"
 *     finding, which is the highest false-positive legal risk in this module)
 */
function isUsableScore(ctx: ComplianceContext): boolean {
  if (ctx.accessibilityScore === undefined) return false;
  if (ctx.accessibilityScoreSource === 'unavailable') return false;
  if (ctx.accessibilityScore === 0) return false;
  return true;
}

export function runWcagAttestationModule(crawl: CrawlResult, ctx: ComplianceContext): RawFinding[] {
  const findings: RawFinding[] = [];

  // ── Fail-closed path ────────────────────────────────────────────────────────
  // Emit a single neutral INFO finding and return early. We must not attempt
  // to infer anything about WCAG conformance from an absent or zero score.
  if (!isUsableScore(ctx)) {
    findings.push({
      moduleId: 'P5-04',
      severity: 'INFO',
      category: 'Accessibility Compliance',
      title: 'WCAG signal unavailable (accessibility scan did not produce a usable score)',
      location: crawl.finalUrl,
      evidence: [
        ctx.accessibilityScore === undefined
          ? 'accessibilityScore: not set'
          : `accessibilityScore: ${ctx.accessibilityScore}`,
        `accessibilityScoreSource: ${ctx.accessibilityScoreSource ?? 'not set'}`,
      ].join(' | '),
      explanation:
        'The accessibility pass did not return a usable score for this page. ' +
        'This can happen when Lighthouse could not reach the page, when the ' +
        'accessibility audit was skipped, or when the headless render failed. ' +
        'No WCAG 2.2 AA inference can be drawn from this result.',
      impact:
        'No compliance signal is available. A manual accessibility review is ' +
        'recommended to assess conformance with WCAG 2.2 AA, ADA, Section 508, ' +
        'and EN 301 549 as applicable to the site.',
      fixManual: [
        'Ensure the page is publicly reachable and does not block headless browsers.',
        'Re-run the scan to attempt a fresh Lighthouse accessibility audit.',
        'Commission a manual WCAG 2.2 AA audit for a definitive conformance assessment.',
      ],
      fixAiPrompt:
        'The automated accessibility scan could not produce a score for this page. ' +
        'Help me identify common reasons a Lighthouse accessibility audit might fail ' +
        'and suggest a checklist for a manual WCAG 2.2 AA review.',
    });

    return findings;
  }

  // ── Signal path — usable score exists ───────────────────────────────────────
  // We have a non-zero score from a successful Lighthouse pass. Emit a factual
  // signal. We deliberately do NOT surface the raw number as a compliance
  // verdict — the score is rounded to a tier label to prevent it being read
  // as a percentage of conformance.
  const score = ctx.accessibilityScore as number; // narrowed: undefined/0 excluded above

  // Classify into a qualitative tier. Labels are deliberately non-legal and
  // non-definitive ("low signals" not "non-compliant").
  let scoreTier: string;
  let severity: RawFinding['severity'];
  if (score >= 90) {
    scoreTier = 'high (≥90)';
    severity = 'INFO';
  } else if (score >= 70) {
    scoreTier = 'moderate (70–89)';
    severity = 'LOW';
  } else {
    scoreTier = 'low (<70)';
    severity = 'MEDIUM';
  }

  // Detect an accessibility statement link (presence only — not validated).
  const a11yStatementHref = detectAccessibilityStatementLink(crawl, ctx);
  const statementNote = a11yStatementHref
    ? `An accessibility statement link was detected (href: "${a11yStatementHref}").`
    : 'No accessibility statement link was detected on this page.';

  findings.push({
    moduleId: 'P5-04',
    severity,
    category: 'Accessibility Compliance',
    title: `Lighthouse accessibility signal: ${scoreTier} score tier`,
    location: crawl.finalUrl,
    evidence:
      // Explicitly state the score source and limitation so downstream consumers
      // (LLM enrichment, report UI) cannot misread this as a compliance verdict.
      `Lighthouse accessibility subset score tier: ${scoreTier}. ` +
      `Source: ${ctx.accessibilityScoreSource ?? 'lab'}. ` +
      statementNote,
    explanation:
      'This signal is derived from Lighthouse\'s automated accessibility checks, ' +
      'which cover a subset of WCAG 2.2 success criteria detectable by static ' +
      'analysis. It is NOT a full WCAG 2.2 AA audit and cannot be used as a ' +
      'compliance attestation. Relevant regulatory frameworks that reference ' +
      'WCAG 2.2 AA include the ADA (US), Section 508 (US federal), and ' +
      'EN 301 549 (EU) — conformance with these requires a comprehensive audit ' +
      'by a qualified assessor, not an automated scan.',
    impact:
      'A lower Lighthouse accessibility score suggests more potential barriers ' +
      'for users of assistive technology. It does not constitute a legal finding. ' +
      'Organisations subject to ADA, Section 508, or EN 301 549 should commission ' +
      'a qualified WCAG 2.2 AA audit independently of this scan.',
    fixManual: [
      'Review the detailed Lighthouse accessibility report for specific rule failures.',
      'Use a screen reader (NVDA, VoiceOver, JAWS) to manually test key user flows.',
      'Engage an accessibility specialist for a WCAG 2.2 AA conformance evaluation.',
      a11yStatementHref
        ? 'Verify the detected accessibility statement is current and accurate.'
        : 'Consider publishing an accessibility statement describing known limitations and remediation plans.',
    ],
    fixAiPrompt:
      `My site received a Lighthouse accessibility score in the "${scoreTier}" tier. ` +
      'This is based on an automated subset of WCAG 2.2 checks. ' +
      'Help me identify the most common WCAG 2.2 AA failures, prioritise fixes ' +
      'by impact on assistive technology users, and draft an accessibility statement.',
  });

  return findings;
}

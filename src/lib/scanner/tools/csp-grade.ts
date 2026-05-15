/**
 * Phase 3.13 — pure CSP strength grader.
 *
 * Thin, deterministic wrapper around Google's `csp_evaluator` (Apache-2.0,
 * the engine behind csp-evaluator.withgoogle.com — already in the tree as a
 * transitive dependency of `lighthouse`, pinned to 1.1.5). No I/O.
 *
 * `csp_evaluator`'s own severities do not map 1:1 to our rubric (it rates a
 * standalone `unsafe-eval` MEDIUM_MAYBE and a missing `object-src` HIGH), so
 * we map by finding *type* to realise the Phase 3.13 severity table, with a
 * conservative severity-based fallback for the long tail. The fallback never
 * yields HIGH — only genuine `unsafe-inline` / `unsafe-eval` in an enforcing
 * `script-src` (the two explicitly-HIGH rows) ever surface as HIGH, so an
 * engine quirk can't surprise-escalate a finding.
 */

import { CspParser } from 'csp_evaluator/dist/parser.js';
import { CspEvaluator } from 'csp_evaluator/dist/evaluator.js';
import { Severity as CspSeverity, Type as CspType } from 'csp_evaluator/dist/finding.js';
import type { Severity } from '../types';

export interface CspIssue {
  severity: Severity;
  /** Stable csp_evaluator Type enum id — lets the module de-dupe / title. */
  type: number;
  directive: string;
  description: string;
}

export interface CspGrade {
  issues: CspIssue[];
}

const CSP_ISSUE_LIMIT = 8;

/** Phase 3.13 severity table, keyed by csp_evaluator finding type. */
const TYPE_SEVERITY = new Map<CspType, Severity>([
  [CspType.SCRIPT_UNSAFE_INLINE, 'HIGH'],
  [CspType.SCRIPT_UNSAFE_EVAL, 'HIGH'],
  [CspType.SCRIPT_UNSAFE_HASHES, 'MEDIUM'],
  [CspType.PLAIN_WILDCARD, 'MEDIUM'],
  [CspType.PLAIN_URL_SCHEMES, 'MEDIUM'],
  [CspType.WILDCARD_URL, 'MEDIUM'],
  [CspType.SCRIPT_ALLOWLIST_BYPASS, 'MEDIUM'],
  [CspType.OBJECT_ALLOWLIST_BYPASS, 'MEDIUM'],
  [CspType.IP_SOURCE, 'MEDIUM'],
  [CspType.MISSING_DIRECTIVES, 'LOW'],
  [CspType.SRC_HTTP, 'LOW'],
  [CspType.NONCE_LENGTH, 'LOW'],
  [CspType.STATIC_NONCE, 'LOW'],
  [CspType.REPORT_TO_ONLY, 'LOW'],
  [CspType.REPORTING_DESTINATION_MISSING, 'LOW'],
  [CspType.DEPRECATED_DIRECTIVE, 'INFO'],
  [CspType.UNKNOWN_DIRECTIVE, 'INFO'],
]);

/**
 * Conservative fallback for types not in the table above. Deliberately caps
 * at MEDIUM so the only HIGH findings are the two explicit unsafe-* rows.
 */
function fallbackSeverity(s: CspSeverity): Severity | null {
  switch (s) {
    case CspSeverity.HIGH:
    case CspSeverity.MEDIUM:
      return 'MEDIUM';
    case CspSeverity.HIGH_MAYBE:
    case CspSeverity.MEDIUM_MAYBE:
    case CspSeverity.SYNTAX:
      return 'LOW';
    case CspSeverity.STRICT_CSP:
    case CspSeverity.INFO:
      return 'INFO';
    case CspSeverity.NONE:
    default:
      return null;
  }
}

/**
 * Grade an *enforcing* `Content-Security-Policy` header value. Returns the
 * mapped, de-duplicated, capped issue list. An empty list means the policy is
 * strong by our rubric (nonce/hash, no unsafe-*, no broad allowlists) — the
 * caller emits no finding in that case.
 *
 * Pure: never throws (a malformed CSP just yields whatever the parser makes
 * of it), no I/O. Do not call this on a Report-Only-only policy — those
 * directives are not enforced; the module handles that case separately.
 */
export function gradeCsp(cspValue: string): CspGrade {
  let findings;
  try {
    const parsed = new CspParser(cspValue).csp;
    findings = new CspEvaluator(parsed).evaluate();
  } catch {
    // A genuinely unparseable policy is fail-soft: emit no graded issues
    // rather than crash the scan. The scanner must never throw on hostile
    // input; the module still surfaces missing/Report-Only CSP separately.
    return { issues: [] };
  }

  const seen = new Set<string>();
  const issues: CspIssue[] = [];
  for (const f of findings) {
    const severity = TYPE_SEVERITY.get(f.type) ?? fallbackSeverity(f.severity);
    if (!severity) continue;
    const dedupeKey = `${f.type}|${f.directive}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    issues.push({
      severity,
      type: f.type,
      directive: f.directive,
      description: f.description,
    });
  }

  const rank: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
  issues.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return { issues: issues.slice(0, CSP_ISSUE_LIMIT) };
}

const ORIGIN_RE = /^https?:\/\/[^/]+$/i;

/**
 * Build a conservative `Content-Security-Policy-Report-Only` starter from
 * origins actually observed in the crawl. Safe to paste *by construction*:
 * Report-Only never blocks anything, and the policy contains no `unsafe-*`
 * and no `*`. Deterministic (origins de-duplicated + sorted). The caller
 * prefixes the "monitor reports, tighten before enforcing" caveat.
 */
export function buildReportOnlyStarter(observedOrigins: string[]): string {
  const origins = Array.from(
    new Set(
      observedOrigins
        .map((o) => o.trim())
        .filter((o) => ORIGIN_RE.test(o))
        .map((o) => o.replace(/\/+$/, '')),
    ),
  ).sort();

  const list = origins.length ? ' ' + origins.join(' ') : '';
  return [
    `default-src 'self'`,
    `script-src 'self'${list}`,
    `style-src 'self'${list}`,
    `img-src 'self' data:${list}`,
    `font-src 'self' data:`,
    `connect-src 'self'${list}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'self'`,
  ].join('; ');
}

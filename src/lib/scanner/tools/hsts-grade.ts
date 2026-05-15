/**
 * Phase 3.13 — pure HSTS strength grader.
 *
 * Today HSTS is binary present/absent in P1-03: a 1-day `max-age` with no
 * `includeSubDomains` scores clean. This parses the directive and emits the
 * Phase 3.13 graded findings. No I/O, never throws.
 */

import type { Severity } from '../types';

export interface HstsIssue {
  severity: Severity;
  /** Stable machine code for de-dupe / titling at the module layer. */
  code: 'HSTS_SHORT_MAX_AGE' | 'HSTS_NO_SUBDOMAINS' | 'HSTS_NOT_PRELOAD_ELIGIBLE';
  detail: string;
}

/** One year in seconds — the HSTS preload list minimum and our recommended floor. */
const ONE_YEAR = 31_536_000;

/**
 * Grade a `Strict-Transport-Security` header value. An empty issue list means
 * the policy is strong (>= 1yr max-age, includeSubDomains, preload-eligible).
 */
export function gradeHsts(stsValue: string): { issues: HstsIssue[] } {
  const v = stsValue.toLowerCase();

  const maxAgeMatch = v.match(/max-age\s*=\s*"?(\d+)"?/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 0;
  const hasSubDomains = /(^|;|\s)includesubdomains(\s|;|$)/.test(v);
  const hasPreload = /(^|;|\s)preload(\s|;|$)/.test(v);

  const issues: HstsIssue[] = [];

  if (maxAge < ONE_YEAR) {
    issues.push({
      severity: 'LOW',
      code: 'HSTS_SHORT_MAX_AGE',
      detail: `max-age=${maxAge} is below the recommended ${ONE_YEAR} (1 year); the HTTPS guarantee expires sooner than it should.`,
    });
  }

  if (!hasSubDomains) {
    issues.push({
      severity: 'LOW',
      code: 'HSTS_NO_SUBDOMAINS',
      detail: 'includeSubDomains is not set, so subdomains are not covered by HSTS and remain downgrade-attackable.',
    });
  }

  if (!hasPreload || maxAge < ONE_YEAR) {
    issues.push({
      severity: 'INFO',
      code: 'HSTS_NOT_PRELOAD_ELIGIBLE',
      detail: 'Not eligible for the browser HSTS preload list (requires the preload token and max-age >= 31536000).',
    });
  }

  return { issues };
}

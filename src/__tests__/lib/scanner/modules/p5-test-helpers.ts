/**
 * Shared test helpers for the Phase 5 compliance modules (P5-01 … P5-06)
 * and the compliance orchestrator.
 *
 * These helpers build minimal CrawlResult / ComplianceContext fixtures so each
 * test only states the fields it actually exercises. No hardcoded shared
 * mutable state — every call returns a fresh object.
 */

import type {
  CrawlResult,
  ComplianceContext,
  ParsedCookie,
  NetworkRequest,
  RawFinding,
} from '@/lib/scanner/types';

export function makeCookie(overrides: Partial<ParsedCookie> = {}): ParsedCookie {
  return {
    name: 'session',
    value: 'x',
    secure: true,
    httpOnly: true,
    sameSite: 'Lax',
    domain: null,
    path: '/',
    ...overrides,
  };
}

export function makeNetworkRequest(
  overrides: Partial<NetworkRequest> = {},
): NetworkRequest {
  return {
    url: 'https://example.com/app.js',
    method: 'GET',
    resourceType: 'script',
    status: 200,
    fromCache: false,
    ...overrides,
  };
}

export function makeCrawl(overrides: Partial<CrawlResult> = {}): CrawlResult {
  return {
    finalUrl: 'https://example.com/',
    statusCode: 200,
    headers: {},
    cookies: [],
    jsBundleUrls: [],
    inlineScriptContent: '',
    html: '',
    tls: null,
    stack: '',
    renderMode: 'headless',
    ...overrides,
  };
}

export function makeCtx(
  overrides: Partial<ComplianceContext> = {},
): ComplianceContext {
  return {
    ...overrides,
  };
}

/**
 * Regulation names are explicitly allowed as neutral context. These are the
 * only compliance-claim words permitted to appear in P5 output.
 */
const ALLOWED_REGULATION_TOKENS = [
  'gdpr',
  'ccpa',
  'wcag',
  'ada',
  'section 508',
  'en 301 549',
  'eprivacy',
  'pipeda',
];

/**
 * Forbidden attestation / verdict vocabulary. If any of these appear in a
 * finding's user-visible text it means the module made a compliance claim,
 * which is the highest legal risk on this surface.
 *
 * Note: "compliance" / "compliant" are matched with word boundaries so that
 * the legitimate category string "Privacy & Compliance" and "Accessibility
 * Compliance" are NOT flagged (those are category labels, not verdicts), while
 * a sentence like "this site is compliant" still is. We instead assert on the
 * stronger verdict words.
 */
const FORBIDDEN_VERDICT_WORDS = [
  'certified',
  'attestation',
  'guarantee',
  'guaranteed',
  'is compliant',
  'are compliant',
  'fully compliant',
  'non-compliant',
];

/**
 * Numeric-score / fraction patterns that must never appear in P5 finding text.
 * Examples that should match: "85/100", "7/8", "92%", "score: 85".
 * Year-like 4-digit numbers ("WCAG 2.2", "GDPR 2016", "max-age=31536000") are
 * NOT a compliance score and are excluded by the patterns below.
 */
const SCORE_PATTERNS: RegExp[] = [
  /\b\d{1,3}\s*\/\s*\d{1,3}\b/, // "85/100", "7/8"
  /\b\d{1,3}\s*%/, // "92%"
  /\bscore\s*[:=]\s*\d/i, // "score: 85"
  /\b\d{1,3}\s*out of\s*\d{1,3}\b/i, // "85 out of 100"
];

export function assertNoAttestationLanguage(finding: RawFinding): void {
  const fields = [
    finding.title,
    finding.evidence,
    finding.explanation,
    finding.impact,
  ];
  for (const raw of fields) {
    const text = raw.toLowerCase();
    for (const word of FORBIDDEN_VERDICT_WORDS) {
      if (text.includes(word)) {
        throw new Error(
          `Finding ${finding.moduleId} contains forbidden verdict word "${word}" in: ${raw}`,
        );
      }
    }
    for (const pat of SCORE_PATTERNS) {
      if (pat.test(raw)) {
        throw new Error(
          `Finding ${finding.moduleId} contains a numeric compliance score matching ${pat} in: ${raw}`,
        );
      }
    }
  }
}

export { ALLOWED_REGULATION_TOKENS };

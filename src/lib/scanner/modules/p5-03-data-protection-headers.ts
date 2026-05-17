/**
 * P5-03 — Data-protection-relevant headers
 *
 * Re-inspects crawl.headers for the subset of headers that carry particular
 * weight when the site handles personal data. This is a pure signal module:
 * it emits factual observations about header presence and configuration; it
 * does NOT assert legal compliance or regulatory verdicts of any kind.
 *
 * Headers examined here also appear in P1-03 (Security Headers). The two
 * modules serve different purposes — P1-03 is a general security inventory;
 * P5-03 narrows to the data-protection lens and is consumed by the Phase-5
 * compliance pipeline. No code from p1-03 is imported.
 *
 * Design decisions:
 * - Pure function over crawl.headers — NO outbound requests.
 * - All header lookups are case-insensitive (headers are already lower-cased
 *   by the crawler, but we normalise defensively in getHeader()).
 * - Regulatory names appear at most once per finding as neutral background
 *   context (e.g. "relevant to data-protection frameworks such as GDPR"),
 *   never as a verdict or compliance assertion.
 * - Severities are capped at MEDIUM — these are informational signals, not
 *   direct exploitability findings.
 */

import type { CrawlResult, ComplianceContext, RawFinding } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Cap a header value string to MAX_HEADER_EVIDENCE_LEN characters to prevent
 * unexpectedly long or attacker-controlled header values from inflating scan
 * output. Mirrors the clip() pattern used in p1-17-service-worker.ts.
 */
const MAX_HEADER_EVIDENCE_LEN = 200;
function clipHeader(value: string): string {
  return value.length > MAX_HEADER_EVIDENCE_LEN
    ? `${value.slice(0, MAX_HEADER_EVIDENCE_LEN)}…`
    : value;
}

/**
 * Case-insensitive header lookup. CrawlResult.headers keys should already be
 * lower-cased by the crawler, but we normalise the key here so the module
 * does not silently miss a header if the crawler ever changes behaviour.
 */
function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase();
  // Fast path — key already lower-cased (expected case)
  if (Object.prototype.hasOwnProperty.call(headers, lower)) return headers[lower];
  // Slow path — scan for a case-insensitive match
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

// ── Header-specific validation helpers ────────────────────────────────────

// Values of Referrer-Policy that send the full URL (including path and query)
// to cross-origin destinations. These are weak from a data-minimisation
// perspective because query parameters may carry personal data.
const REFERRER_POLICY_DISCLOSURE_VALUES = new Set([
  'unsafe-url',
  'no-referrer-when-downgrade',
  'origin-when-cross-origin',
]);

/**
 * Returns true if the Referrer-Policy value is considered data-protective
 * (does not send full URL cross-origin).
 */
function isReferrerPolicyStrong(value: string): boolean {
  const tokens = value
    .toLowerCase()
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return false; // empty value — treat as absent
  return !tokens.some((t) => REFERRER_POLICY_DISCLOSURE_VALUES.has(t));
}

// Sensitive feature categories in Permissions-Policy that are directly
// relevant to personal data (device sensors, location, payments).
const SENSITIVE_PERMISSIONS = ['camera', 'microphone', 'geolocation', 'payment'];

/**
 * Returns true if no sensitive Permissions-Policy feature is wildcarded.
 * A wildcard allowlist ("*") grants access to any embedded third-party script,
 * which conflicts with purpose-limitation principles.
 */
function isPermissionsPolicyStrong(value: string): boolean {
  const directives = value.split(',').map((d) => d.trim()).filter(Boolean);
  for (const directive of directives) {
    const eq = directive.indexOf('=');
    if (eq === -1) continue;
    const name = directive.slice(0, eq).trim().toLowerCase();
    const allowlist = directive.slice(eq + 1).trim();
    if (!SENSITIVE_PERMISSIONS.includes(name)) continue;
    if (allowlist === '*' || allowlist.includes('*')) return false;
  }
  return true;
}

/**
 * Returns true if the HSTS header specifies a max-age of at least one year
 * (31536000 seconds). Shorter durations are treated as a weak configuration
 * because they leave gaps where unencrypted connections are possible.
 */
function isHstsStrong(value: string): boolean {
  const match = /max-age\s*=\s*(\d+)/i.exec(value);
  if (!match) return false;
  return parseInt(match[1], 10) >= 31536000;
}

// ── Check definitions ──────────────────────────────────────────────────────

interface HeaderCheckDef {
  header: string;
  /** Finding title when the header is absent. */
  missingTitle: string;
  /** Finding title when the header is present but weak (requires validate). */
  weakTitle?: string;
  severity: RawFinding['severity'];
  /** If provided, called on the header value. Return false → weak finding. */
  validate?: (value: string) => boolean;
  missingEvidence: (header: string) => string;
  weakEvidence?: (header: string, value: string) => string;
  explanation: string;
  weakExplanation?: string;
  impact: string;
  fixManual: string[];
  fixAiPrompt: string;
}

// Each entry uses plain factual wording. The phrase "data-protection frameworks
// such as GDPR" appears at most once per finding and only as neutral context —
// never as a compliance verdict.
const CHECKS: HeaderCheckDef[] = [
  {
    header: 'strict-transport-security',
    missingTitle: 'Data-protection-relevant header not set: Strict-Transport-Security',
    weakTitle: 'Strict-Transport-Security max-age is shorter than one year',
    severity: 'MEDIUM',
    validate: isHstsStrong,
    missingEvidence: (h) => `${h} header not present`,
    weakEvidence: (h, v) => `${h}: ${v} (max-age below 31536000)`,
    explanation:
      'Strict-Transport-Security (HSTS) instructs browsers to connect over HTTPS only, ' +
      'preventing unencrypted transmission of personal data. Its absence means a user on ' +
      'an untrusted network could have form submissions or session tokens intercepted before ' +
      "the server's HTTPS redirect is applied. Transport encryption is a baseline technical " +
      'measure relevant to data-protection frameworks such as GDPR.',
    weakExplanation:
      'The HSTS max-age is set but is shorter than one year (31536000 s). A shorter ' +
      'duration means browsers will allow unencrypted connections again after the TTL ' +
      'expires, reducing the window of enforced encryption.',
    impact:
      'Personal data (form fields, session cookies, authentication tokens) may be ' +
      'transmitted in clear text over networks where the user cannot complete the HTTPS ' +
      'handshake before an interception occurs.',
    fixManual: [
      'Add: Strict-Transport-Security: max-age=31536000; includeSubDomains',
      'In Next.js, set this in the headers() config in next.config.js.',
      'Verify the site is fully accessible over HTTPS before enabling HSTS.',
    ],
    fixAiPrompt:
      'Add Strict-Transport-Security: max-age=31536000; includeSubDomains to my Next.js ' +
      'response headers via next.config.js. Show the full headers() config block.',
  },
  {
    header: 'content-security-policy',
    missingTitle: 'Data-protection-relevant header not set: Content-Security-Policy',
    severity: 'MEDIUM',
    missingEvidence: (h) => `${h} header not present`,
    explanation:
      'Content-Security-Policy (CSP) limits which scripts and resources the browser ' +
      'may load. Without it, an XSS vulnerability could allow a script to read and ' +
      'exfiltrate personal data (form inputs, localStorage, cookies) to an attacker-' +
      'controlled endpoint. Restricting script execution is a practical technical control ' +
      'for protecting data in transit to the browser.',
    impact:
      'A successful XSS attack on a page that handles personal data can extract that data ' +
      'silently. CSP materially raises the bar for exfiltration even when an injection ' +
      'point is present.',
    fixManual: [
      "Start with a report-only policy: Content-Security-Policy-Report-Only: default-src 'self'",
      'Review the report endpoint for violations, then tighten and promote to enforcement.',
      'Add specific domain allowlists for analytics, fonts, and third-party scripts.',
    ],
    fixAiPrompt:
      'Add a Content-Security-Policy header to my Next.js app. Start with report-only mode ' +
      'to audit current resource usage, then help me write an enforcement policy.',
  },
  {
    header: 'referrer-policy',
    missingTitle: 'Data-protection-relevant header not set: Referrer-Policy',
    weakTitle: 'Referrer-Policy may disclose URL data to cross-origin destinations',
    severity: 'LOW',
    validate: isReferrerPolicyStrong,
    missingEvidence: (h) => `${h} header not present`,
    weakEvidence: (h, v) => `${h}: ${v} (sends full URL cross-origin)`,
    explanation:
      'Referrer-Policy controls how much of the page URL is included in the Referer ' +
      'header when a user navigates to another site. Without a restrictive policy, the ' +
      'full URL — including any query parameters — is sent to third-party destinations. ' +
      'Query parameters frequently carry personal data such as user IDs, search terms, or ' +
      'email addresses. Data-minimisation principles in frameworks such as GDPR recommend ' +
      'sending only the bare origin when crossing site boundaries.',
    weakExplanation:
      "Values such as 'unsafe-url', 'no-referrer-when-downgrade', and " +
      "'origin-when-cross-origin' still transmit the full URL path and query to " +
      'cross-origin destinations. Using a stricter value limits personal data leakage.',
    impact:
      'Personal data embedded in query parameters (user identifiers, tokens, email ' +
      'addresses) may be logged by third-party analytics, ad networks, or embedded widget ' +
      "providers without the user's knowledge.",
    fixManual: [
      'Add: Referrer-Policy: strict-origin-when-cross-origin',
      'This sends only the origin on cross-origin navigation and the full URL within your own site.',
      'Use no-referrer for maximum privacy if referrer analytics are not required.',
    ],
    fixAiPrompt:
      'Add Referrer-Policy: strict-origin-when-cross-origin to my Next.js response headers.',
  },
  {
    header: 'permissions-policy',
    missingTitle: 'Data-protection-relevant header not set: Permissions-Policy',
    weakTitle: 'Permissions-Policy permits broad access to sensitive device features',
    severity: 'LOW',
    validate: isPermissionsPolicyStrong,
    missingEvidence: (h) => `${h} header not present`,
    weakEvidence: (h, v) => `${h}: ${v} (sensitive feature allowed with wildcard)`,
    explanation:
      'Permissions-Policy restricts whether the browser may grant camera, microphone, ' +
      'geolocation, and payment access to the page and any embedded iframes. Without it, ' +
      'third-party scripts or iframes can request these sensitive capabilities. Limiting ' +
      'access to what the application actually requires is consistent with data-minimisation ' +
      'principles.',
    weakExplanation:
      'A wildcard ("*") on a sensitive feature (camera, microphone, geolocation, or ' +
      'payment) allows any embedded iframe to request that capability. Restrict each ' +
      'sensitive directive to "(self)" or a named origin list.',
    impact:
      'A compromised or malicious third-party script embedded on the page could request ' +
      'camera, microphone, or geolocation access without the user realising the source is ' +
      'not the first-party site.',
    fixManual: [
      'Add: Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
      'Adjust the allowlist per feature based on what the application actually uses.',
    ],
    fixAiPrompt:
      'Add a Permissions-Policy header to my Next.js app that restricts camera, ' +
      'microphone, geolocation, and payment to self only.',
  },
  {
    header: 'x-content-type-options',
    missingTitle: 'Data-protection-relevant header not set: X-Content-Type-Options',
    severity: 'LOW',
    missingEvidence: (h) => `${h} header not present`,
    explanation:
      'X-Content-Type-Options: nosniff prevents browsers from guessing the MIME type ' +
      'of a response. Without it, a browser may execute an uploaded file (e.g. an image ' +
      'with embedded JavaScript) as a script. This is particularly relevant on sites that ' +
      'accept file uploads from users, where MIME-type confusion can lead to script ' +
      'execution and data exposure.',
    impact:
      'On sites that accept file uploads, MIME-sniffing could allow a malicious upload ' +
      'to execute as JavaScript, providing a path to access session data or personal ' +
      'information stored in the browser.',
    fixManual: ['Add: X-Content-Type-Options: nosniff to all responses.'],
    fixAiPrompt:
      'Add X-Content-Type-Options: nosniff to all responses in my Next.js app via next.config.js.',
  },
];

// ── Module entry point ─────────────────────────────────────────────────────

/**
 * Re-inspects crawl.headers for the data-protection-relevant header subset
 * and emits a RawFinding for each header that is absent or weakly configured.
 *
 * The ctx (ComplianceContext) parameter is accepted for API consistency with
 * other P5 modules and to support future conditional logic (e.g. skipping
 * checks when renderMode is 'fetch-only' and headers are unreliable). It is
 * not consumed in this version because all checks are header-presence checks
 * that are valid regardless of render mode.
 */
export function runDataProtectionHeadersModule(
  crawl: CrawlResult,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ctx: ComplianceContext,
): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const check of CHECKS) {
    const value = getHeader(crawl.headers, check.header);
    const present = value !== undefined && value !== '';

    if (present && check.validate) {
      const strong = check.validate(value!);
      if (strong) continue; // header present and value is acceptable

      // Header present but weak. Cap the raw header value to prevent an
      // attacker-controlled or unusually long header from inflating evidence.
      findings.push({
        moduleId: 'P5-03',
        category: 'Data Protection',
        severity: check.severity,
        title: check.weakTitle ?? check.missingTitle,
        location: 'HTTP response headers',
        evidence: check.weakEvidence
          ? check.weakEvidence(check.header, clipHeader(value!))
          : `${check.header}: ${clipHeader(value!)} (insufficient)`,
        explanation: check.weakExplanation ?? check.explanation,
        impact: check.impact,
        fixManual: check.fixManual,
        fixAiPrompt: check.fixAiPrompt,
      });
    } else if (!present) {
      // Header entirely absent
      findings.push({
        moduleId: 'P5-03',
        category: 'Data Protection',
        severity: check.severity,
        title: check.missingTitle,
        location: 'HTTP response headers',
        evidence: check.missingEvidence(check.header),
        explanation: check.explanation,
        impact: check.impact,
        fixManual: check.fixManual,
        fixAiPrompt: check.fixAiPrompt,
      });
    }
    // else: header present and either no validator or validator passed → no finding
  }

  return findings;
}

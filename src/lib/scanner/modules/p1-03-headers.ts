import type { CrawlResult, RawFinding } from '../types';
import { features } from '@/lib/features';

interface HeaderCheck {
  header: string;
  title: string;
  severity: RawFinding['severity'];
  explanation: string;
  impact: string;
  fixManual: string[];
  fixAiPrompt: string;
  validate?: (value: string) => boolean; // returns true if the value is GOOD
  /** When the header is present but `validate` returns false, use this title instead. */
  weakTitle?: string;
  /** When the header is present but `validate` returns false, use this explanation instead. */
  weakExplanation?: string;
  /** Phase 3.8: gate this check behind a feature flag. Always-on checks omit this. */
  flag?: 'headerCoverageChecks';
}

const REFERRER_POLICY_WEAK_VALUES = new Set([
  'unsafe-url',
  'no-referrer-when-downgrade',
  'origin-when-cross-origin',
]);

const PERMISSIONS_POLICY_SENSITIVE_FEATURES = [
  'camera',
  'microphone',
  'geolocation',
  'payment',
  'usb',
  'serial',
];

function validateReferrerPolicy(value: string): boolean {
  const tokens = value.toLowerCase().split(',').map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return true;
  return !tokens.some((t) => REFERRER_POLICY_WEAK_VALUES.has(t));
}

function validatePermissionsPolicy(value: string): boolean {
  const directives = value.split(',').map((d) => d.trim()).filter(Boolean);
  for (const directive of directives) {
    const eq = directive.indexOf('=');
    if (eq === -1) continue;
    const name = directive.slice(0, eq).trim().toLowerCase();
    const allowlist = directive.slice(eq + 1).trim();
    if (!PERMISSIONS_POLICY_SENSITIVE_FEATURES.includes(name)) continue;
    if (allowlist === '*' || allowlist.includes('*')) return false;
  }
  return true;
}

const COOP_ACCEPTED = new Set(['same-origin', 'same-origin-allow-popups']);
const COEP_ACCEPTED = new Set(['require-corp', 'credentialless']);

function validateCoop(value: string): boolean {
  return COOP_ACCEPTED.has(value.toLowerCase().trim());
}

function validateCoep(value: string): boolean {
  return COEP_ACCEPTED.has(value.toLowerCase().trim());
}

const HEADER_CHECKS: HeaderCheck[] = [
  {
    header: 'content-security-policy',
    title: 'Missing Content-Security-Policy (CSP) header',
    severity: 'MEDIUM',
    explanation: 'CSP controls which scripts, styles, and resources the browser is allowed to load. Without it, a single XSS vulnerability can load scripts from any domain and fully compromise user sessions.',
    impact: 'If any XSS vulnerability exists (in your code or a third-party script), attackers have no guardrails — they can load external scripts, exfiltrate data, and steal credentials.',
    fixManual: [
      "Add Content-Security-Policy to your response headers via next.config.js or vercel.json.",
      "Start with a report-only policy to see what would break: Content-Security-Policy-Report-Only: default-src 'self'",
      "Tighten the policy progressively, adding specific domains as needed.",
    ],
    fixAiPrompt: "Add a Content-Security-Policy header to my Next.js app deployed on Vercel. Start with a report-only mode that allows my current resources, then help me tighten it.",
  },
  {
    header: 'strict-transport-security',
    title: 'Missing Strict-Transport-Security (HSTS) header',
    severity: 'MEDIUM',
    explanation: 'HSTS tells browsers to always use HTTPS. Without it, users who type your domain without https:// may be sent an unencrypted HTTP response before being redirected — long enough for an attacker on the same network to intercept traffic.',
    impact: 'Users on public Wi-Fi or networks with a malicious proxy could have their session cookies intercepted before the HTTPS redirect.',
    fixManual: [
      "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains",
      "In Next.js, add this to the headers() config in next.config.js.",
      "If on Vercel, add to vercel.json under headers.",
    ],
    fixAiPrompt: "Add a Strict-Transport-Security header to my Next.js app with max-age=31536000 and includeSubDomains. Show me how to add it in next.config.js and vercel.json.",
  },
  {
    header: 'x-frame-options',
    title: 'Missing X-Frame-Options header',
    severity: 'LOW',
    explanation: 'Without this header, your site can be embedded in an <iframe> on a malicious page. Attackers use this for clickjacking — tricking users into clicking buttons they cannot see.',
    impact: 'Clickjacking attacks can trick users into submitting forms, changing settings, or performing account actions they did not intend.',
    fixManual: [
      "Add: X-Frame-Options: SAMEORIGIN",
      "Or use CSP: frame-ancestors 'self' (more modern and flexible).",
    ],
    fixAiPrompt: "Add X-Frame-Options: SAMEORIGIN to my Next.js response headers to prevent clickjacking.",
  },
  {
    header: 'x-content-type-options',
    title: 'Missing X-Content-Type-Options header',
    severity: 'LOW',
    explanation: 'Without nosniff, browsers may try to guess the content type of responses, which can allow attackers to cause browsers to execute uploaded files as scripts.',
    impact: 'MIME-type confusion attacks can allow XSS via file uploads if the browser misinterprets a text file as JavaScript.',
    fixManual: ["Add: X-Content-Type-Options: nosniff to all responses."],
    fixAiPrompt: "Add X-Content-Type-Options: nosniff to all responses in my Next.js app.",
  },
  {
    header: 'referrer-policy',
    title: 'Missing Referrer-Policy header',
    severity: 'INFO',
    explanation: 'Without a Referrer-Policy, the full URL of your pages (including any sensitive query parameters) is sent to third-party sites when users click external links.',
    impact: 'Sensitive data in query parameters (user IDs, tokens, search terms) may leak to analytics or ad networks.',
    fixManual: ["Add: Referrer-Policy: strict-origin-when-cross-origin"],
    fixAiPrompt: "Add Referrer-Policy: strict-origin-when-cross-origin to my Next.js headers config.",
    validate: validateReferrerPolicy,
    weakTitle: 'Weak Referrer-Policy value',
    weakExplanation: 'Values like "unsafe-url", "no-referrer-when-downgrade", and "origin-when-cross-origin" still leak path and query to cross-origin destinations. Use a strict-origin variant so only the bare origin (or nothing) is shared cross-site.',
    flag: 'headerCoverageChecks',
  },
  {
    header: 'permissions-policy',
    title: 'Missing Permissions-Policy header',
    severity: 'INFO',
    explanation: 'Permissions-Policy restricts which browser features (camera, microphone, geolocation) your site and embedded iframes can access. Without it, any third-party script could request access to these features.',
    impact: 'Malicious or compromised third-party scripts could request sensitive device permissions.',
    fixManual: [
      "Add: Permissions-Policy: camera=(), microphone=(), geolocation=()",
      "Customize to allow only the features your app actually uses.",
    ],
    fixAiPrompt: "Add a Permissions-Policy header to my Next.js app that disables camera, microphone, and geolocation by default.",
    validate: validatePermissionsPolicy,
    weakTitle: 'Overly permissive Permissions-Policy directive',
    weakExplanation: 'A sensitive feature (camera, microphone, geolocation, payment, usb, or serial) is allowlisted with "*", meaning any embedded iframe — including third-party scripts — can request it. Restrict each sensitive directive to "self" or an explicit origin list.',
    flag: 'headerCoverageChecks',
  },
  {
    header: 'cross-origin-opener-policy',
    title: 'Missing Cross-Origin-Opener-Policy (COOP) header',
    severity: 'INFO',
    explanation: 'COOP isolates your page from cross-origin windows opened via window.open or popups. Without it, a malicious site you opened a popup to can read state from your window via opener references, enabling cross-window data leaks (Spectre-class and tabnapping risks).',
    impact: 'Cross-origin popups or openers can probe your page state. Cross-origin isolation features (SharedArrayBuffer, high-resolution timers) also require this header.',
    fixManual: [
      "Add: Cross-Origin-Opener-Policy: same-origin",
      "Use same-origin-allow-popups if you need to keep references to popups you open.",
    ],
    fixAiPrompt: "Add Cross-Origin-Opener-Policy: same-origin to my Next.js response headers via next.config.js.",
    validate: validateCoop,
    weakTitle: 'Weak Cross-Origin-Opener-Policy value',
    weakExplanation: 'Values other than "same-origin" or "same-origin-allow-popups" (notably the default "unsafe-none") leave the window addressable by cross-origin openers. Set COOP to "same-origin" unless you maintain references to cross-origin popups.',
    flag: 'headerCoverageChecks',
  },
  {
    header: 'cross-origin-embedder-policy',
    title: 'Missing Cross-Origin-Embedder-Policy (COEP) header',
    severity: 'INFO',
    explanation: 'COEP requires every cross-origin resource you load to opt-in via CORP or CORS. Combined with COOP it enables cross-origin isolation, which is required by SharedArrayBuffer and high-resolution timers and which materially raises the bar for cross-process side-channel attacks.',
    impact: 'Without COEP, cross-origin isolation is off and side-channel attacks across origins are easier to mount. Some advanced APIs (SharedArrayBuffer, performance.measureUserAgentSpecificMemory) are also unavailable.',
    fixManual: [
      "Add: Cross-Origin-Embedder-Policy: require-corp",
      "If third-party embeds break, try credentialless instead of require-corp.",
    ],
    fixAiPrompt: "Add Cross-Origin-Embedder-Policy: require-corp to my Next.js response headers via next.config.js.",
    validate: validateCoep,
    weakTitle: 'Weak Cross-Origin-Embedder-Policy value',
    weakExplanation: 'Values other than "require-corp" or "credentialless" (notably the default "unsafe-none") disable cross-origin isolation. Set COEP to "require-corp" so embedded resources must opt in.',
    flag: 'headerCoverageChecks',
  },
];

const SCRIPT_SRC_RE = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
const INTEGRITY_RE = /\bintegrity\s*=\s*["'][^"']+["']/i;
const SRI_EVIDENCE_LIMIT = 5;

function parseOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function checkSri(crawl: CrawlResult): RawFinding | null {
  const pageOrigin = parseOrigin(crawl.finalUrl);
  if (!pageOrigin) return null;

  const html = crawl.cleanedHtml ?? crawl.html;
  if (!html) return null;

  const offending: string[] = [];
  for (const match of html.matchAll(SCRIPT_SRC_RE)) {
    const tag = match[0];
    const src = match[1];
    if (!src || !/^https?:\/\//i.test(src)) continue;

    const scriptOrigin = parseOrigin(src);
    if (!scriptOrigin || scriptOrigin === pageOrigin) continue;

    if (INTEGRITY_RE.test(tag)) continue;

    offending.push(src);
  }

  if (offending.length === 0) return null;

  const sample = offending.slice(0, SRI_EVIDENCE_LIMIT);
  const more = offending.length > SRI_EVIDENCE_LIMIT
    ? ` (and ${offending.length - SRI_EVIDENCE_LIMIT} more)`
    : '';

  return {
    moduleId: 'P1-03',
    severity: 'LOW',
    category: 'Security Headers',
    title: 'Cross-origin scripts loaded without Subresource Integrity (SRI)',
    location: 'Initial HTML <script src> tags',
    evidence: sample.map((u) => `<script src="${u}"> (no integrity)`).join('\n') + more,
    explanation: 'Subresource Integrity (SRI) lets the browser verify a fetched script matches a known hash before executing it. Cross-origin scripts loaded without an `integrity` attribute will be executed unconditionally, so a compromise of the CDN, a typosquatted host, or a hostile mirror can silently swap the script for malicious code.',
    impact: 'If any of the third-party CDNs serving these scripts is compromised, the swapped script runs with full access to your origin — including session cookies, localStorage, and user input.',
    fixManual: [
      'For each cross-origin <script src="...">, add integrity="sha384-..." and crossorigin="anonymous".',
      'Generate hashes via: openssl dgst -sha384 -binary <file> | openssl base64 -A',
      'Prefer pinning a specific version of the asset so the hash stays stable.',
    ],
    fixAiPrompt: `Add Subresource Integrity (SRI) attributes to the cross-origin <script src> tags in my site. The offending scripts are: ${offending.join(', ')}. Show me how to compute the sha384 hash and add integrity + crossorigin="anonymous" attributes.`,
  };
}

/**
 * Parse and evaluate the strictness of a CSP header value.
 *
 * Strategy:
 *  1. Find the effective script policy: prefer script-src, fall back to default-src.
 *  2. If strict-dynamic is present, bail out — it neutralises host-source allowlists
 *     and unsafe-inline in CSP3, so there is nothing meaningful to flag.
 *  3. Check for unsafe-inline (HIGH), but only when no nonce or hash is also present
 *     in the same directive (CSP2 nonce/hash neutralises unsafe-inline).
 *  4. Check for unsafe-eval (HIGH).
 *  5. Check for bare wildcard sources: *, http:, https: (HIGH).
 *     Scoped wildcards like *.googleapis.com are NOT flagged — they restrict
 *     the origin to a known domain family and are a legitimate pattern.
 *
 * Returns [] when the header is absent; the HEADER_CHECKS table handles that case.
 */
function checkCsp(crawl: CrawlResult): RawFinding[] {
  const findings: RawFinding[] = [];

  // Helper that analyses one raw CSP header value and returns findings.
  // `headerName` is used for evidence; `isReportOnly` downgrades severity to INFO.
  function analyseCspValue(rawValue: string, headerName: string, isReportOnly: boolean): void {
    const directives = rawValue.split(';').map((d) => d.trim()).filter(Boolean);

    // Build a map of directive-name → tokens (lower-cased source expressions).
    // Directive names are case-insensitive per spec.
    const directiveMap = new Map<string, string[]>();
    for (const directive of directives) {
      const [name, ...rest] = directive.split(/\s+/);
      directiveMap.set(name.toLowerCase(), rest.map((t) => t.toLowerCase()));
    }

    // Find the effective script policy: script-src takes precedence over default-src.
    const effectiveTokens =
      directiveMap.get('script-src') ?? directiveMap.get('default-src') ?? null;

    // No script policy at all — nothing to evaluate here.
    if (!effectiveTokens) return;

    const directiveName = directiveMap.has('script-src') ? 'script-src' : 'default-src';

    // If strict-dynamic is present, it overrides host-source allowlists and
    // neutralises unsafe-inline in supporting browsers. Flagging would be a FP.
    if (effectiveTokens.includes("'strict-dynamic'")) return;

    const severity = isReportOnly ? 'INFO' : 'HIGH';
    // Suffix appended to titles/evidence for report-only headers so the user
    // knows the policy is not currently enforced.
    const roSuffix = isReportOnly ? ' (report-only, not enforced)' : '';

    // ── unsafe-inline check ────────────────────────────────────────────────
    if (effectiveTokens.includes("'unsafe-inline'")) {
      // CSP2: a nonce or hash in the same directive neutralises unsafe-inline
      // in nonce/hash-aware browsers. Only flag when neither is present.
      const hasNonce = effectiveTokens.some((t) => /^'nonce-/i.test(t));
      const hasHash = effectiveTokens.some((t) => /^'sha(?:256|384|512)-/i.test(t));
      if (!hasNonce && !hasHash) {
        findings.push({
          moduleId: 'P1-03',
          severity,
          category: 'Security Headers',
          title: `CSP allows 'unsafe-inline' scripts${roSuffix}`,
          location: 'HTTP response headers',
          evidence: `${headerName}: ...${directiveName} contains 'unsafe-inline'${roSuffix}`,
          explanation:
            "'unsafe-inline' in a script-src (or default-src fallback) directive allows any inline <script> block and javascript: URLs to execute. This completely defeats CSP's ability to block XSS payloads that are injected as inline scripts — the most common XSS vector.",
          impact:
            'An attacker who can inject any inline HTML can run arbitrary JavaScript in the victim\'s browser, bypassing CSP protection entirely.',
          fixManual: [
            "Remove 'unsafe-inline' from the directive.",
            "Use nonces: generate a cryptographically random nonce per request, add it to every <script> tag, and add 'nonce-{value}' to script-src.",
            "Alternatively, add 'strict-dynamic' with a nonce/hash to allow trusted scripts to load others without an allowlist.",
          ],
          fixAiPrompt:
            "My Content-Security-Policy has 'unsafe-inline' in the script-src. Show me how to replace it with per-request nonces in my Next.js app so I can remove 'unsafe-inline' without breaking my scripts.",
        });
      }
    }

    // ── unsafe-eval check ─────────────────────────────────────────────────
    if (effectiveTokens.includes("'unsafe-eval'")) {
      findings.push({
        moduleId: 'P1-03',
        severity,
        category: 'Security Headers',
        title: `CSP allows 'unsafe-eval' scripts${roSuffix}`,
        location: 'HTTP response headers',
        evidence: `${headerName}: ...${directiveName} contains 'unsafe-eval'${roSuffix}`,
        explanation:
          "'unsafe-eval' enables eval(), new Function(), and similar dynamic code execution APIs. These APIs are a common target in second-stage XSS: an attacker who can control a string can turn it into executable code. CSP's default is to block them.",
        impact:
          "If an attacker controls any string value in your application (via stored or reflected XSS), 'unsafe-eval' lets them convert that string into running code, greatly expanding the exploitable surface.",
        fixManual: [
          "Remove 'unsafe-eval'. Audit your code and dependencies for use of eval(), new Function(), setTimeout/setInterval with string arguments, and similar.",
          'Many bundlers (webpack, esbuild) can be configured to avoid generating code that needs eval().',
          "Some libraries (Handlebars, AngularJS) require eval(); switch to template-literal alternatives or precompile templates at build time.",
        ],
        fixAiPrompt:
          "My Content-Security-Policy has 'unsafe-eval'. Help me find which part of my Next.js app is using eval() or new Function() so I can remove the unsafe-eval allowance.",
      });
    }

    // ── bare wildcard sources check ───────────────────────────────────────
    // Flag: bare * (any origin), http: (any HTTP origin), https: (any HTTPS origin).
    // Do NOT flag scoped wildcards like *.googleapis.com — those contain a '.'
    // and restrict the allowed domain to a specific registrar.
    const BARE_WILDCARDS = new Set(['*', 'http:', 'https:']);
    for (const token of effectiveTokens) {
      if (BARE_WILDCARDS.has(token)) {
        findings.push({
          moduleId: 'P1-03',
          severity,
          category: 'Security Headers',
          title: `CSP uses a bare wildcard source ('${token}') in ${directiveName}${roSuffix}`,
          location: 'HTTP response headers',
          evidence: `${headerName}: ...${directiveName} contains bare source '${token}'${roSuffix}`,
          explanation: `A bare '${token}' source expression allows scripts from any origin (or any HTTP/HTTPS origin), which is functionally equivalent to having no CSP at all for script loading. An attacker-controlled domain anywhere on the internet becomes a valid script source.`,
          impact:
            'Any attacker-controlled server becomes an allowed script source. An XSS that can inject a <script> tag pointing anywhere will bypass this policy.',
          fixManual: [
            `Replace '${token}' with an explicit allowlist of domains you actually load scripts from (e.g. 'self', 'https://cdn.jsdelivr.net').`,
            "Use 'strict-dynamic' with a nonce/hash to avoid needing an allowlist of CDN origins at all.",
          ],
          fixAiPrompt: `My Content-Security-Policy has '${token}' as a source in ${directiveName}. Help me replace it with a specific allowlist of the domains I actually load scripts from in my Next.js app.`,
        });
        // Break after the first wildcard match: multiple bare wildcards in the same directive
        // convey the same severity, so one finding is sufficient; the fix addresses all of them.
        break;
      }
    }
  }

  // ── Enforced CSP ──────────────────────────────────────────────────────────
  const cspValue = crawl.headers['content-security-policy'];
  if (cspValue) {
    analyseCspValue(cspValue, 'content-security-policy', false);
  }
  // If CSP absent: return [] — HEADER_CHECKS table emits the MEDIUM absent-CSP finding.

  // ── Report-only CSP ───────────────────────────────────────────────────────
  // Analysed separately because report-only policies are not enforced by the
  // browser — the same weak directives are still worth flagging, but at INFO
  // severity so operators see that the policy would not protect them in production.
  const reportOnlyValue = crawl.headers['content-security-policy-report-only'];
  if (reportOnlyValue) {
    analyseCspValue(reportOnlyValue, 'content-security-policy-report-only', true);
  }

  return findings;
}

/**
 * Validate HSTS max-age and includeSubDomains.
 *
 * Returns [] when the header is absent; the HEADER_CHECKS table handles that case.
 *
 * Rules:
 *  - max-age < 15_768_000 (≈6 months): LOW — too short to provide meaningful
 *    HSTS protection (HSTS preload lists require ≥1 year).
 *  - max-age ≥ 15_768_000 but missing includeSubDomains: INFO — subdomains
 *    are reachable over HTTP and could be used to set cookies / conduct
 *    cookie-injection attacks against the apex domain.
 *  - Well-formed (≥ 15_768_000 + includeSubDomains): return [].
 */
function checkHsts(crawl: CrawlResult): RawFinding[] {
  const value = crawl.headers['strict-transport-security'];
  if (!value) return []; // HEADER_CHECKS table emits the MEDIUM absent-HSTS finding.

  const maxAgeMatch = /max-age\s*=\s*(\d+)/i.exec(value);
  if (!maxAgeMatch) {
    // Malformed — no max-age directive at all. Emit LOW because HSTS without
    // max-age is not a valid header and browsers will ignore it.
    return [
      {
        moduleId: 'P1-03',
        severity: 'LOW',
        category: 'Security Headers',
        title: 'Strict-Transport-Security header has no max-age directive',
        location: 'HTTP response headers',
        evidence: `strict-transport-security: ${value} (no max-age)`,
        explanation:
          'An HSTS header without a max-age directive is invalid and will be ignored by browsers. max-age defines how long (in seconds) the browser should remember to use HTTPS.',
        impact:
          'The HSTS header is silently ignored, leaving users unprotected against SSL stripping attacks on subsequent visits.',
        fixManual: [
          'Add max-age=31536000 (one year) to your Strict-Transport-Security header.',
          'Example: Strict-Transport-Security: max-age=31536000; includeSubDomains',
        ],
        fixAiPrompt:
          'My Strict-Transport-Security header is missing a max-age directive. Show me how to set it correctly in my Next.js app.',
      },
    ];
  }

  const maxAge = parseInt(maxAgeMatch[1], 10);
  // 6 months is the recommended minimum to provide meaningful HSTS protection;
  // HSTS preload list submission also requires ≥1 year, so this threshold prevents
  // false negatives for domains that plan to preload later.
  const SIX_MONTHS_SECONDS = 15_768_000;

  if (maxAge < SIX_MONTHS_SECONDS) {
    return [
      {
        moduleId: 'P1-03',
        severity: 'LOW',
        category: 'Security Headers',
        title: 'Strict-Transport-Security max-age is too short',
        location: 'HTTP response headers',
        evidence: `strict-transport-security: ${value} (max-age=${maxAge}, minimum recommended: ${SIX_MONTHS_SECONDS})`,
        explanation: `HSTS max-age tells the browser how long to remember to always use HTTPS. A value of ${maxAge} seconds (≈${Math.round(maxAge / 86400)} days) is below the recommended minimum of 6 months (${SIX_MONTHS_SECONDS}s). Short max-age values greatly reduce the window of HSTS protection between visits.`,
        impact:
          'Users who have not visited for longer than the max-age period lose HSTS protection and could be subjected to SSL stripping on their next visit.',
        fixManual: [
          `Raise max-age to at least ${SIX_MONTHS_SECONDS} (6 months), ideally 31536000 (1 year).`,
          'HSTS preload list submission requires max-age ≥ 31536000.',
        ],
        fixAiPrompt:
          `My HSTS max-age is only ${maxAge} seconds. Show me how to set it to at least 31536000 in my Next.js next.config.js headers config.`,
      },
    ];
  }

  // max-age is long enough — check for includeSubDomains.
  // Case-insensitive per RFC 6797 §6.1.
  if (!/includesubdomains/i.test(value)) {
    return [
      {
        moduleId: 'P1-03',
        severity: 'INFO',
        category: 'Security Headers',
        title: 'Strict-Transport-Security missing includeSubDomains',
        location: 'HTTP response headers',
        evidence: `strict-transport-security: ${value} (includeSubDomains absent)`,
        explanation:
          'Without includeSubDomains, HSTS applies only to the exact hostname, not to subdomains. Subdomains (e.g. api.example.com, login.example.com) can still be reached over plain HTTP and may be vulnerable to cookie-injection attacks against the apex domain.',
        impact:
          'Cookie-injection attacks: an attacker can set cookies on subdomains over HTTP (via SSL stripping) that then affect requests to the secured apex domain.',
        fixManual: [
          "Add includeSubDomains to your HSTS header: Strict-Transport-Security: max-age=31536000; includeSubDomains",
          'Ensure all subdomains also respond over HTTPS before enabling this, or HSTS will block HTTP-only subdomains.',
        ],
        fixAiPrompt:
          "My Strict-Transport-Security header is missing includeSubDomains. Show me how to add it safely in my Next.js app, including what to check before enabling it.",
      },
    ];
  }

  // Well-formed: max-age ≥ 6 months + includeSubDomains present.
  return [];
}

export function runHeadersModule(crawl: CrawlResult): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const check of HEADER_CHECKS) {
    if (check.flag && !features[check.flag]) continue;

    const value = crawl.headers[check.header];
    const present = !!value;
    const weak = present && check.validate ? !check.validate(value) : false;
    const missing = !present;

    if (!missing && !weak) continue;

    const isWeak = weak && check.weakTitle;
    findings.push({
      moduleId: 'P1-03',
      severity: check.severity,
      category: 'Security Headers',
      title: isWeak ? check.weakTitle! : check.title,
      location: 'HTTP response headers',
      evidence: present
        ? `${check.header}: ${value} (insufficient)`
        : `${check.header} header not present`,
      explanation: isWeak && check.weakExplanation ? check.weakExplanation : check.explanation,
      impact: check.impact,
      fixManual: check.fixManual,
      fixAiPrompt: check.fixAiPrompt,
    });
  }

  if (features.headerCoverageChecks) {
    const sriFinding = checkSri(crawl);
    if (sriFinding) findings.push(sriFinding);
  }

  // CSP strictness and HSTS parameter checks are always-on (no feature flag).
  // They only fire when the header is present; absent-header findings are
  // already emitted by the HEADER_CHECKS table above.
  findings.push(...checkCsp(crawl));
  findings.push(...checkHsts(crawl));

  return findings;
}

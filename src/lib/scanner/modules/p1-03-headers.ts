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

  return findings;
}

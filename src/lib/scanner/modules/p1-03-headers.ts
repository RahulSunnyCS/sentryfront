import type { CrawlResult, RawFinding } from '../types';

interface HeaderCheck {
  header: string;
  title: string;
  severity: RawFinding['severity'];
  explanation: string;
  impact: string;
  fixManual: string[];
  fixAiPrompt: string;
  validate?: (value: string) => boolean; // returns true if the value is GOOD
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
  },
];

export function runHeadersModule(crawl: CrawlResult): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const check of HEADER_CHECKS) {
    const value = crawl.headers[check.header];
    const missing = !value || (check.validate && !check.validate(value));

    if (missing) {
      findings.push({
        moduleId: 'P1-03',
        severity: check.severity,
        category: 'Security Headers',
        title: check.title,
        location: 'HTTP response headers',
        evidence: value ? `${check.header}: ${value} (insufficient)` : `${check.header} header not present`,
        explanation: check.explanation,
        impact: check.impact,
        fixManual: check.fixManual,
        fixAiPrompt: check.fixAiPrompt,
      });
    }
  }

  return findings;
}

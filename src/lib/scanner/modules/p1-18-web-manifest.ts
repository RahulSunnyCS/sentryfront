import type { CrawlResult, RawFinding } from '../types';

// Phase 3.8.4 — P1-18: Web-App Manifest Exposure
//
// Web-app manifests live at a URL referenced by <link rel="manifest"> and are
// intentionally public. They're rarely a security issue on their own — but
// they sometimes leak developer emails, internal hostnames, broaden the app's
// claimed URL space beyond what was intended, or carry tracking params in
// start_url that fire on every offline launch.
//
// This module reads `crawl.manifestUrl` and `crawl.manifestJson` (populated by
// the crawler in Phase 3.8.4) and produces MEDIUM / LOW findings. It is a
// no-op when those fields are absent so flag-off scans are unchanged.

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const INTERNAL_HOST_PATTERNS: RegExp[] = [
  /\.local\b/i,
  /\.internal\b/i,
  /\blocalhost\b/i,
  /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  /\b172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}\b/,
  /\b192\.168\.\d{1,3}\.\d{1,3}\b/,
];

function walkStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) walkStrings(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) walkStrings(v, out);
  }
}

function findInternalHostnames(strings: string[]): string[] {
  const hits = new Set<string>();
  for (const s of strings) {
    for (const re of INTERNAL_HOST_PATTERNS) {
      const m = re.exec(s);
      if (m) hits.add(m[0]);
    }
  }
  return Array.from(hits);
}

function findEmails(strings: string[]): string[] {
  const hits = new Set<string>();
  for (const s of strings) {
    let m: RegExpExecArray | null;
    EMAIL_RE.lastIndex = 0;
    while ((m = EMAIL_RE.exec(s)) !== null) {
      hits.add(m[0]);
    }
  }
  return Array.from(hits);
}

function startUrlHasTrackingParams(startUrl: string, manifestUrl: string): string[] {
  try {
    const u = new URL(startUrl, manifestUrl);
    const tracking: string[] = [];
    u.searchParams.forEach((_value, k) => {
      if (/^utm_|^ref$|^source$|^gclid$|^fbclid$/i.test(k)) tracking.push(k);
    });
    return tracking;
  } catch {
    return [];
  }
}

function isScopeOverreach(scope: string, manifestUrl: string): { scopePath: string; manifestPath: string } | null {
  try {
    const m = new URL(manifestUrl);
    const s = new URL(scope, manifestUrl);
    // Treat trailing-slash variants uniformly.
    const scopePath = s.pathname.endsWith('/') ? s.pathname : s.pathname + '/';
    const manifestDir = m.pathname.replace(/\/[^/]*$/, '/') || '/';
    if (scopePath === '/' && manifestDir !== '/') {
      return { scopePath, manifestPath: manifestDir };
    }
    return null;
  } catch {
    return null;
  }
}

function redactEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local[0]}***${domain}`;
  return `${local.slice(0, 2)}***${domain}`;
}

export function runWebManifestModule(crawl: CrawlResult): RawFinding[] {
  if (!crawl.manifestUrl) return [];

  // Sub-check: the link was present but the body never arrived (404 / non-JSON).
  if (!crawl.manifestJson) {
    return [{
      moduleId: 'P1-18',
      severity: 'LOW',
      category: 'Web-App Manifest Exposure',
      title: 'Web-app manifest linked but not fetchable',
      location: crawl.manifestUrl,
      evidence: `<link rel="manifest" href="${crawl.manifestUrl}"> · fetch returned no body`,
      explanation:
        'The page declares a <link rel="manifest"> but the linked URL returned no JSON body when we fetched it. Either the manifest is missing (404) or the host returned an error. Browsers that act on the link will fail PWA installability checks.',
      impact:
        'Broken PWA install + offline behaviour. Not a security risk on its own, but worth fixing so installable-app UX works as intended.',
      fixManual: [
        'Verify the manifest URL returns a 2xx with the JSON body.',
        'If the manifest is not meant to exist, remove the <link rel="manifest"> tag.',
      ],
      fixAiPrompt: `My site links to a web-app manifest at ${crawl.manifestUrl} but the fetch fails. Either fix the manifest URL or remove the <link rel="manifest"> tag.`,
    }];
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(crawl.manifestJson) as Record<string, unknown>;
  } catch {
    return [{
      moduleId: 'P1-18',
      severity: 'LOW',
      category: 'Web-App Manifest Exposure',
      title: 'Web-app manifest does not parse as JSON',
      location: crawl.manifestUrl,
      evidence: `${crawl.manifestJson.slice(0, 120)}…`,
      explanation:
        'The manifest URL returned content but the body is not valid JSON. Browsers will silently ignore the manifest, breaking PWA installability and theme-color hints.',
      impact: 'Broken PWA UX. Not a security risk.',
      fixManual: [
        'Fix the JSON syntax of the manifest file.',
        'Confirm the response Content-Type is application/manifest+json or application/json.',
      ],
      fixAiPrompt: `My web-app manifest at ${crawl.manifestUrl} is not valid JSON. Validate and fix the syntax.`,
    }];
  }

  const findings: RawFinding[] = [];
  const allStrings: string[] = [];
  walkStrings(parsed, allStrings);

  // Check 1: internal hostnames in manifest values (MEDIUM).
  const internalHosts = findInternalHostnames(allStrings);
  if (internalHosts.length > 0) {
    findings.push({
      moduleId: 'P1-18',
      severity: 'MEDIUM',
      category: 'Web-App Manifest Exposure',
      title: 'Web-app manifest references internal hostnames',
      location: crawl.manifestUrl,
      evidence: internalHosts.slice(0, 5).join(', '),
      explanation:
        'The manifest references hostnames that look like internal infrastructure (.local, .internal, RFC1918 IP ranges, or localhost). Manifests are intentionally public — anything in them is fetchable by anyone who looks.',
      impact:
        'Attackers gain free reconnaissance of your internal naming scheme without sending a single probe. Pair this with a permissive SSRF and the internal host becomes reachable.',
      fixManual: [
        'Remove internal hostname references from the manifest.',
        'Use relative URLs or the production hostname for all manifest fields.',
      ],
      fixAiPrompt: `My web-app manifest at ${crawl.manifestUrl} references internal hostnames (${internalHosts.join(', ')}). Replace them with relative URLs or the production hostname.`,
    });
  }

  // Check 2: developer / internal email leakage (MEDIUM).
  const emails = findEmails(allStrings);
  if (emails.length > 0) {
    findings.push({
      moduleId: 'P1-18',
      severity: 'MEDIUM',
      category: 'Web-App Manifest Exposure',
      title: 'Web-app manifest exposes developer email address(es)',
      location: crawl.manifestUrl,
      evidence: emails.slice(0, 3).map(redactEmail).join(', '),
      explanation:
        'The manifest contains email addresses. Manifests are public — anyone who installs your PWA (or scrapes manifests in bulk) sees these addresses. Most often the address belongs to the lead developer and gets harvested into spam / phishing lists within days.',
      impact:
        'Targeted phishing of the named developer; possible information disclosure if the email is on a non-public domain.',
      fixManual: [
        'Replace personal email addresses in the manifest with a role address (e.g. support@yourcompany.com) or remove the field entirely.',
        'Audit the manifest for `developer.email`, `contact`, or custom-extension fields that carry personal data.',
      ],
      fixAiPrompt: `My web-app manifest at ${crawl.manifestUrl} exposes email addresses. Replace personal addresses with a role mailbox or remove the field entirely.`,
    });
  }

  // Check 3: scope overreach (MEDIUM).
  if (typeof parsed['scope'] === 'string') {
    const overreach = isScopeOverreach(parsed['scope'] as string, crawl.manifestUrl);
    if (overreach) {
      findings.push({
        moduleId: 'P1-18',
        severity: 'MEDIUM',
        category: 'Web-App Manifest Exposure',
        title: 'Web-app manifest scope claims more URL space than the app',
        location: crawl.manifestUrl,
        evidence: `manifest at ${overreach.manifestPath} declares scope ${overreach.scopePath}`,
        explanation:
          'The manifest declares a scope of "/" but lives in a sub-path. When installed, the PWA will claim the entire origin\'s URL space — including paths owned by other teams or apps on the same domain.',
        impact:
          'Multi-app hosting on a single origin can lead to unexpected install behaviour and cross-app routing in installed PWAs.',
        fixManual: [
          `Set the manifest scope to match the app's URL path (e.g. "${overreach.manifestPath}").`,
          'Or move the manifest file to the application root if the entire origin really is one app.',
        ],
        fixAiPrompt: `My web-app manifest at ${crawl.manifestUrl} declares scope "/" but lives in a sub-path. Tighten the scope to "${overreach.manifestPath}".`,
      });
    }
  }

  // Check 4: tracking parameters in start_url (LOW).
  if (typeof parsed['start_url'] === 'string') {
    const tracking = startUrlHasTrackingParams(parsed['start_url'] as string, crawl.manifestUrl);
    if (tracking.length > 0) {
      findings.push({
        moduleId: 'P1-18',
        severity: 'LOW',
        category: 'Web-App Manifest Exposure',
        title: 'Web-app manifest start_url contains tracking parameters',
        location: crawl.manifestUrl,
        evidence: `start_url: ${parsed['start_url']} · tracking params: ${tracking.join(', ')}`,
        explanation:
          'Every time a user launches the installed PWA, the browser navigates to start_url. Tracking parameters there fire on every cold start — even offline — and may inflate analytics or violate user expectations.',
        impact:
          'No security impact. Privacy / analytics hygiene only.',
        fixManual: [
          'Remove tracking parameters from start_url. If you need install attribution, use the manifest\'s `id` field or the `referrer` data the browser already exposes.',
        ],
        fixAiPrompt: `My web-app manifest at ${crawl.manifestUrl} has tracking parameters in start_url (${tracking.join(', ')}). Remove them.`,
      });
    }
  }

  return findings;
}

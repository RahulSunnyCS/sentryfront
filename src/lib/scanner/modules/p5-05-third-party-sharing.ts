/**
 * P5-05: Third-Party Data Sharing Module
 * Phase 5: Compliance Scanning
 *
 * Enumerates third-party processor domains observed during the crawl
 * (from JS bundle URLs, network requests, and cookies) and cross-checks
 * whether a privacy policy link is visible on the page.
 *
 * This module emits factual observations only — no score, no verdict,
 * no regulatory fine amounts. Regulation names (GDPR, CCPA) are cited
 * as neutral context so developers understand why the signal matters.
 *
 * Pure function: makes NO outbound network requests.
 */

import * as cheerio from 'cheerio';
import type { CrawlResult, RawFinding, ComplianceContext } from '../types';

// --- Domain classifier (mirrors p1-09; duplicated because p1-09 does not
//     export its KNOWN_DOMAINS map or classifyDomain helper) ---

type Category = 'analytics' | 'ads' | 'payment' | 'support' | 'cdn' | 'auth' | 'monitoring' | 'unknown';

interface DomainInfo {
  category: Category;
  name: string;
}

// Minimal KNOWN_DOMAINS map — intentionally kept in sync with p1-09's list.
// When p1-09 gains new entries, add them here too (same file, same PR).
const KNOWN_DOMAINS: Record<string, DomainInfo> = {
  'google-analytics.com': { category: 'analytics', name: 'Google Analytics' },
  'googletagmanager.com': { category: 'analytics', name: 'Google Tag Manager' },
  'analytics.google.com': { category: 'analytics', name: 'Google Analytics' },
  'mixpanel.com': { category: 'analytics', name: 'Mixpanel' },
  'segment.com': { category: 'analytics', name: 'Segment' },
  'cdn.segment.com': { category: 'analytics', name: 'Segment' },
  'hotjar.com': { category: 'analytics', name: 'Hotjar' },
  'static.hotjar.com': { category: 'analytics', name: 'Hotjar' },
  'plausible.io': { category: 'analytics', name: 'Plausible' },
  'posthog.com': { category: 'analytics', name: 'PostHog' },
  'amplitude.com': { category: 'analytics', name: 'Amplitude' },
  'js.stripe.com': { category: 'payment', name: 'Stripe' },
  'checkout.stripe.com': { category: 'payment', name: 'Stripe Checkout' },
  'js.paypal.com': { category: 'payment', name: 'PayPal' },
  'pay.google.com': { category: 'payment', name: 'Google Pay' },
  'appleid.cdn-apple.com': { category: 'payment', name: 'Apple Pay' },
  'cdn.jsdelivr.net': { category: 'cdn', name: 'jsDelivr CDN' },
  'unpkg.com': { category: 'cdn', name: 'unpkg CDN' },
  'cdnjs.cloudflare.com': { category: 'cdn', name: 'Cloudflare CDNJS' },
  'cdn.cloudflare.com': { category: 'cdn', name: 'Cloudflare CDN' },
  'code.jquery.com': { category: 'cdn', name: 'jQuery CDN' },
  'intercom.io': { category: 'support', name: 'Intercom' },
  'widget.intercom.io': { category: 'support', name: 'Intercom' },
  'zendesk.com': { category: 'support', name: 'Zendesk' },
  'crisp.chat': { category: 'support', name: 'Crisp' },
  'client.crisp.chat': { category: 'support', name: 'Crisp' },
  'accounts.google.com': { category: 'auth', name: 'Google Auth' },
  'auth0.com': { category: 'auth', name: 'Auth0' },
  'clerk.com': { category: 'auth', name: 'Clerk' },
  'sentry.io': { category: 'monitoring', name: 'Sentry' },
  'browser.sentry-cdn.com': { category: 'monitoring', name: 'Sentry' },
  'datadog-browser-agent.com': { category: 'monitoring', name: 'Datadog RUM' },
  'doubleclick.net': { category: 'ads', name: 'Google Ads' },
  'googlesyndication.com': { category: 'ads', name: 'Google Ads' },
  'facebook.net': { category: 'ads', name: 'Facebook Pixel' },
  'connect.facebook.net': { category: 'ads', name: 'Facebook Pixel' },
};

function classifyDomain(hostname: string): DomainInfo {
  if (KNOWN_DOMAINS[hostname]) return KNOWN_DOMAINS[hostname];
  for (const [domain, info] of Object.entries(KNOWN_DOMAINS)) {
    if (hostname.endsWith(`.${domain}`) || hostname === domain) return info;
  }
  return { category: 'unknown', name: hostname };
}

// --- Registrable-host extraction ---
// Strips leading "www." so "www.example.com" and "example.com" are treated as
// the same first-party host. A full Public Suffix List lookup would be more
// precise, but is out of scope for a passive scan and would require a network
// fetch or a large bundled list. The simple approach covers the vast majority
// of real-world cases without over-flagging sub-domains of the target.
function registrableHost(hostname: string): string {
  return hostname.replace(/^www\./, '');
}

// --- Privacy-policy link detector ---
// Operates on HTML text only (no fetch). Checks anchor text and href for the
// word "privacy" (case-insensitive). This is intentionally a heuristic — it
// detects presence of a visible link, not whether the policy content meets any
// legal standard.
function hasPrivacyPolicyLink(html: string): boolean {
  try {
    const $ = cheerio.load(html);
    let found = false;
    $('a').each((_i, el) => {
      if (found) return;
      const text = $(el).text().toLowerCase();
      const href = ($(el).attr('href') ?? '').toLowerCase();
      if (text.includes('privacy') || href.includes('privacy')) {
        found = true;
      }
    });
    return found;
  } catch {
    // If cheerio fails for any reason, treat as not observed rather than
    // throwing — a parse error should not crash the scan.
    return false;
  }
}

// --- Module entry point ---

export function runThirdPartyDataSharingModule(
  crawl: CrawlResult,
  // ctx is accepted for API consistency with other P5 modules even though
  // this module does not currently use accessibilityScore or renderMode.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ctx: ComplianceContext,
): RawFinding[] {
  const findings: RawFinding[] = [];

  // Determine the first-party registrable host so we can exclude it.
  let baseHost: string;
  try {
    baseHost = registrableHost(new URL(crawl.finalUrl).hostname);
  } catch {
    // Unparseable finalUrl — cannot determine first vs third party. Bail out.
    return findings;
  }

  // Collect third-party domains from all three sources in the CrawlResult.
  const processors = new Map<string, DomainInfo>();

  // Source 1: JS bundle <script src> URLs (always present).
  for (const url of crawl.jsBundleUrls) {
    try {
      const hostname = new URL(url).hostname;
      if (registrableHost(hostname) === baseHost) continue;
      if (!processors.has(hostname)) {
        processors.set(hostname, classifyDomain(hostname));
      }
    } catch { /* skip unparseable URLs */ }
  }

  // Source 2: full network request log from headless render (optional).
  if (crawl.networkRequests) {
    for (const req of crawl.networkRequests) {
      try {
        const hostname = new URL(req.url).hostname;
        if (registrableHost(hostname) === baseHost) continue;
        if (!processors.has(hostname)) {
          processors.set(hostname, classifyDomain(hostname));
        }
      } catch { /* skip unparseable URLs */ }
    }
  }

  // Source 3: cookie domain attributes. Cookie domains often start with "."
  // (e.g. ".doubleclick.net") per RFC 6265 — strip the leading dot before
  // comparing so we don't accidentally treat them as third-party when they
  // belong to a subdomain of the target.
  for (const cookie of crawl.cookies) {
    if (!cookie.domain) continue;
    const cookieHost = cookie.domain.replace(/^\./, '');
    if (!cookieHost) continue;
    if (registrableHost(cookieHost) === baseHost) continue;
    if (!processors.has(cookieHost)) {
      processors.set(cookieHost, classifyDomain(cookieHost));
    }
  }

  // No third-party processors observed — emit a brief informational signal.
  if (processors.size === 0) {
    findings.push({
      moduleId: 'P5-05',
      severity: 'INFO',
      category: 'Privacy & Compliance',
      title: 'No third-party data processors observed',
      location: crawl.finalUrl,
      evidence: 'No third-party domains detected in JS bundles, network requests, or cookies.',
      explanation:
        'The passive scan found no resources loaded from third-party domains. ' +
        'This reduces the data-sharing footprint visible to scanners, though ' +
        'server-side integrations are outside the scope of a client-side scan.',
      impact: 'No client-side third-party data sharing detected.',
      fixManual: [],
      fixAiPrompt: '',
    });
    return findings;
  }

  // Privacy-policy link heuristic — preference order: cleanedHtml (noise-
  // reduced), then renderedHtml (post-JS), then raw html (pre-JS fetch).
  const htmlToSearch = crawl.cleanedHtml ?? crawl.renderedHtml ?? crawl.html;
  const privacyLinkObserved = hasPrivacyPolicyLink(htmlToSearch);

  // Build human-readable processor list for evidence strings.
  const entries = Array.from(processors.entries());
  const processorList = entries
    .map(([host, info]) => (info.category !== 'unknown' ? `${info.name} (${host})` : host))
    .join(', ');

  if (!privacyLinkObserved) {
    // Factual signal: processors present but no privacy-policy link visible.
    // Severity LOW — factual observation; the absence of a link on a single
    // page does not confirm non-compliance (policy may be elsewhere or
    // server-side), but the combination is worth surfacing.
    findings.push({
      moduleId: 'P5-05',
      severity: 'LOW',
      category: 'Privacy & Compliance',
      title: 'Third-party data sharing detected; no privacy-policy link observed',
      location: entries.map(([h]) => h).join(', '),
      evidence:
        `Third-party processors detected: ${processorList}.\n` +
        'No link containing "privacy" found in page anchors.',
      explanation:
        'The page loads resources from or sets cookies on third-party domains, ' +
        'which may involve transferring user data to those parties. ' +
        'GDPR (Art. 13) and CCPA require that sites disclose data-sharing ' +
        'practices to users, typically through a visible privacy policy link. ' +
        'No such link was found on this page during the scan. ' +
        'Note: this scanner inspects only the scanned URL — the privacy policy ' +
        'may exist elsewhere on the site.',
      impact:
        'Users may not be informed about third-party data sharing. ' +
        'Regulators (GDPR, CCPA) require clear disclosure when personal data ' +
        'is transferred to third parties.',
      fixManual: [
        'Add a clearly labelled "Privacy Policy" link to the page footer or navigation.',
        'Review each third-party processor and confirm it is documented in your privacy policy.',
        'Ensure users are informed before data is shared (e.g. via a cookie consent banner where required).',
        'Consider whether each third-party integration is necessary for the page to function.',
      ],
      fixAiPrompt:
        `My site loads resources from these third-party domains: ${processorList}. ` +
        'Help me draft the data-processing disclosure section for a privacy policy ' +
        'that covers these processors, and suggest where to add a privacy policy link.',
    });
  } else {
    // Processors present and a privacy-policy link was observed — informational only.
    findings.push({
      moduleId: 'P5-05',
      severity: 'INFO',
      category: 'Privacy & Compliance',
      title: `Third-party data processors observed (privacy policy link present)`,
      location: entries.map(([h]) => h).join(', '),
      evidence:
        `Third-party processors detected: ${processorList}.\n` +
        'A privacy-policy link was observed on the page.',
      explanation:
        'The page loads resources from or sets cookies on third-party domains. ' +
        'A privacy policy link was found on the page, which is a positive signal. ' +
        'This finding is informational — it lists the processors for awareness. ' +
        'GDPR and CCPA require that your privacy policy accurately describes each ' +
        'processor and the data it receives.',
      impact:
        'Low — a privacy policy link is present. Ensure the policy accurately ' +
        'describes each listed processor and the data they receive.',
      fixManual: [
        'Confirm that your privacy policy names each third-party processor listed above.',
        'Verify that your cookie consent mechanism (if required) covers these processors.',
        'Periodically audit third-party integrations and remove unused ones.',
      ],
      fixAiPrompt:
        `My site loads resources from: ${processorList}. ` +
        'Review my privacy policy draft and tell me whether each processor is ' +
        'adequately disclosed, and what data-transfer clauses may be missing.',
    });
  }

  return findings;
}

import type { CrawlResult, RawFinding } from '../types';

type Category = 'analytics' | 'ads' | 'payment' | 'support' | 'cdn' | 'auth' | 'monitoring' | 'unknown';

interface DomainInfo { category: Category; name: string }

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
  // Exact match first
  if (KNOWN_DOMAINS[hostname]) return KNOWN_DOMAINS[hostname];
  // Suffix match
  for (const [domain, info] of Object.entries(KNOWN_DOMAINS)) {
    if (hostname.endsWith(`.${domain}`) || hostname === domain) return info;
  }
  return { category: 'unknown', name: hostname };
}

export function runThirdPartyScriptsModule(crawl: CrawlResult): RawFinding[] {
  const findings: RawFinding[] = [];
  const baseHostname = new URL(crawl.finalUrl).hostname;

  const thirdPartyDomains = new Map<string, DomainInfo>();

  for (const url of crawl.jsBundleUrls) {
    try {
      const hostname = new URL(url).hostname;
      if (hostname === baseHostname) continue;
      if (!thirdPartyDomains.has(hostname)) {
        thirdPartyDomains.set(hostname, classifyDomain(hostname));
      }
    } catch { /* skip */ }
  }

  if (thirdPartyDomains.size === 0) return findings;

  const entries = Array.from(thirdPartyDomains.entries());
  const unknown = entries.filter(([, info]) => info.category === 'unknown').map(([h]) => h);
  const known = entries.filter(([, info]) => info.category !== 'unknown');
  const adDomains = known.filter(([, info]) => info.category === 'ads');

  if (unknown.length > 0) {
    findings.push({
      moduleId: 'P1-09',
      severity: 'MEDIUM',
      category: 'Third-Party Scripts',
      title: `${unknown.length} unrecognized third-party script domain${unknown.length > 1 ? 's' : ''}`,
      location: unknown.join(', '),
      evidence: `Scripts loaded from: ${unknown.join(', ')}`,
      explanation: 'Your site loads JavaScript from domains that are not in the list of commonly known, trusted providers. Unrecognized third-party scripts have full access to your page DOM, user keystrokes, and cookies.',
      impact: 'A compromised or malicious third-party script can steal credentials, payment info, and session tokens from your users.',
      fixManual: [
        'Identify each domain and verify it is intentionally included.',
        'For unrecognized scripts, investigate the source and remove if not needed.',
        'Add Subresource Integrity (SRI) hashes to all third-party script tags.',
        'Consider hosting critical scripts yourself instead of loading from third-party CDNs.',
      ],
      fixAiPrompt: `My site loads scripts from unrecognized domains: ${unknown.join(', ')}. Help me identify these, add Subresource Integrity (SRI) attributes, and remove any that are unnecessary.`,
    });
  }

  if (adDomains.length > 0) {
    const names = adDomains.map(([, info]) => info.name).join(', ');
    findings.push({
      moduleId: 'P1-09',
      severity: 'LOW',
      category: 'Third-Party Scripts',
      title: `Advertising/tracking scripts detected: ${names}`,
      location: adDomains.map(([h]) => h).join(', '),
      evidence: adDomains.map(([h, info]) => `${info.name} (${h})`).join('\n'),
      explanation: 'Advertising and tracking scripts collect detailed user behaviour data and share it with third parties. These scripts also expand your attack surface — a compromise of the ad network affects your users.',
      impact: 'User privacy impact. Also a supply chain risk — ad networks are common targets for malicious script injection.',
      fixManual: [
        'Review whether each ad/tracking script is necessary.',
        "Consider using privacy-respecting analytics (Plausible, Fathom) instead.",
        'Add a Content-Security-Policy to limit which domains can load scripts.',
      ],
      fixAiPrompt: `My site includes advertising and tracking scripts from ${names}. Help me evaluate which are necessary and implement a CSP to limit their access.`,
    });
  }

  // Always emit an INFO finding summarizing all third-party scripts
  if (thirdPartyDomains.size > 0 && unknown.length === 0 && adDomains.length === 0) {
    const summary = entries.map(([, i]) => i.name).join(', ');
    findings.push({
      moduleId: 'P1-09',
      severity: 'INFO',
      category: 'Third-Party Scripts',
      title: `${thirdPartyDomains.size} known third-party script${thirdPartyDomains.size > 1 ? 's' : ''} detected`,
      location: entries.map(([h]) => h).join(', '),
      evidence: summary,
      explanation: 'Your site loads scripts from known third-party providers. All recognized providers are listed here for awareness — each one represents a supply chain dependency.',
      impact: 'Low direct risk. Each third-party script is a dependency that could be compromised.',
      fixManual: [
        'Periodically review third-party script usage and remove anything unused.',
        'Add Subresource Integrity (SRI) hashes where possible.',
      ],
      fixAiPrompt: `My site loads third-party scripts from: ${summary}. Help me add Subresource Integrity hashes and a Content-Security-Policy to lock down which sources are allowed.`,
    });
  }

  return findings;
}

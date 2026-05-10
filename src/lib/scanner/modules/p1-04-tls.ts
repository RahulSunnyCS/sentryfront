import type { CrawlResult, RawFinding } from '../types';

export function runTLSModule(crawl: CrawlResult): RawFinding[] {
  const findings: RawFinding[] = [];
  const parsed = new URL(crawl.finalUrl);

  if (parsed.protocol !== 'https:') {
    findings.push({
      moduleId: 'P1-04',
      severity: 'CRITICAL',
      category: 'TLS Configuration',
      title: 'Site does not use HTTPS',
      location: crawl.finalUrl,
      evidence: `Protocol: ${parsed.protocol}`,
      explanation: 'The site serves content over unencrypted HTTP. All data transmitted between the browser and server — including passwords, session tokens, and personal information — is visible to anyone on the same network.',
      impact: 'Complete traffic interception. Attackers on the same network can read and modify all data in transit.',
      fixManual: [
        'Enable HTTPS on your hosting platform (Vercel, Netlify, and most hosts do this automatically).',
        'Redirect all HTTP traffic to HTTPS.',
        'Set Strict-Transport-Security header after HTTPS is working.',
      ],
      fixAiPrompt: 'My site is serving on HTTP instead of HTTPS. Configure my hosting platform to serve over HTTPS and redirect HTTP to HTTPS.',
    });
    return findings;
  }

  const { tls } = crawl;
  if (!tls) return findings;

  if (!tls.valid) {
    findings.push({
      moduleId: 'P1-04',
      severity: 'CRITICAL',
      category: 'TLS Configuration',
      title: 'TLS certificate is invalid or untrusted',
      location: parsed.hostname,
      evidence: `Certificate validation failed for ${tls.subject ?? parsed.hostname}`,
      explanation: 'The TLS certificate failed validation. This may mean it is self-signed, expired, or issued for a different domain. Browsers show a security warning, and some will block access entirely.',
      impact: 'Browsers warn users that the connection is unsafe. Users who proceed are still vulnerable to interception since authentication has failed.',
      fixManual: [
        'Obtain a trusted certificate from a CA (Let\'s Encrypt is free).',
        'Ensure the certificate domain matches your site\'s hostname exactly.',
        'Check certificate expiry and renew before it expires.',
      ],
      fixAiPrompt: 'My TLS certificate is invalid. Help me obtain and configure a valid certificate for my domain using Let\'s Encrypt or my hosting platform\'s built-in certificate management.',
    });
  }

  if (tls.daysUntilExpiry !== null && tls.daysUntilExpiry <= 30) {
    const severity = tls.daysUntilExpiry <= 7 ? 'CRITICAL' : tls.daysUntilExpiry <= 14 ? 'HIGH' : 'MEDIUM';
    findings.push({
      moduleId: 'P1-04',
      severity,
      category: 'TLS Configuration',
      title: `TLS certificate expires in ${tls.daysUntilExpiry} day${tls.daysUntilExpiry === 1 ? '' : 's'}`,
      location: parsed.hostname,
      evidence: `Expires: ${tls.expiresAt?.toISOString().split('T')[0]} (${tls.daysUntilExpiry} days remaining)`,
      explanation: 'Your TLS certificate is about to expire. When it does, browsers will show a full-screen security warning and most users will not proceed.',
      impact: 'Site becomes inaccessible to most users after expiry. Existing sessions may break.',
      fixManual: [
        'Renew your certificate immediately through your hosting provider or Let\'s Encrypt.',
        'Set up automatic renewal to prevent this in the future.',
      ],
      fixAiPrompt: `My TLS certificate for ${parsed.hostname} expires in ${tls.daysUntilExpiry} days. Help me renew it and set up automatic renewal.`,
    });
  }

  if (tls.protocol && (tls.protocol === 'TLSv1' || tls.protocol === 'TLSv1.1')) {
    findings.push({
      moduleId: 'P1-04',
      severity: 'HIGH',
      category: 'TLS Configuration',
      title: `Outdated TLS protocol in use: ${tls.protocol}`,
      location: parsed.hostname,
      evidence: `Negotiated protocol: ${tls.protocol}`,
      explanation: `TLS 1.0 and 1.1 have known weaknesses (POODLE, BEAST) and are deprecated by all major browsers and the IETF. ${tls.protocol} should not be accepted for new connections.`,
      impact: 'Connections negotiated with TLS 1.0/1.1 may be vulnerable to downgrade attacks.',
      fixManual: [
        'Configure your server to require TLS 1.2 or higher.',
        'On Vercel, Cloudflare, or most CDNs this is a one-click setting.',
        'Disable TLS 1.0 and TLS 1.1 in your server config.',
      ],
      fixAiPrompt: `My server is accepting ${tls.protocol} connections. Configure my hosting or CDN to only allow TLS 1.2 and TLS 1.3.`,
    });
  }

  return findings;
}

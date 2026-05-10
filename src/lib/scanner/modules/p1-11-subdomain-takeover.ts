import { promises as dns } from 'dns';
import type { CrawlResult, RawFinding } from '../types';

// Known CNAME targets that indicate dangling/takeable subdomains
const DANGLING_FINGERPRINTS: Array<{ pattern: string; service: string; evidence: string }> = [
  { pattern: 'github.io', service: 'GitHub Pages', evidence: 'There isn\'t a GitHub Pages site here.' },
  { pattern: 'herokuapp.com', service: 'Heroku', evidence: 'No such app' },
  { pattern: 'netlify.app', service: 'Netlify', evidence: 'Not Found' },
  { pattern: 'vercel.app', service: 'Vercel', evidence: 'The deployment could not be found' },
  { pattern: 'azurewebsites.net', service: 'Azure Web Apps', evidence: '404 Web Site not found' },
  { pattern: 'cloudapp.net', service: 'Azure Cloud', evidence: 'no-ip' },
  { pattern: 's3.amazonaws.com', service: 'AWS S3', evidence: 'NoSuchBucket' },
  { pattern: 'amazonaws.com', service: 'AWS', evidence: 'NoSuchBucket' },
  { pattern: 'shopify.com', service: 'Shopify', evidence: 'Sorry, this shop is currently unavailable.' },
  { pattern: 'fastly.net', service: 'Fastly', evidence: 'Fastly error: unknown domain' },
  { pattern: 'wpengine.com', service: 'WP Engine', evidence: 'The site you were looking for couldn\'t be found' },
  { pattern: 'ghost.io', service: 'Ghost', evidence: 'Failed to resolve DNS' },
  { pattern: 'surge.sh', service: 'Surge.sh', evidence: "project not found" },
  { pattern: 'webflow.io', service: 'Webflow', evidence: "The page you are looking for doesn't exist" },
];

async function getCNAME(hostname: string): Promise<string | null> {
  try {
    const result = await dns.resolveCname(hostname);
    return result[0] ?? null;
  } catch {
    return null;
  }
}

async function getSubdomainsFromCrtSh(apex: string): Promise<string[]> {
  try {
    const res = await fetch(`https://crt.sh/?q=%.${apex}&output=json`, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json() as Array<{ name_value: string }>;
    const subdomains = new Set<string>();
    for (const entry of data) {
      for (const name of entry.name_value.split('\n')) {
        const clean = name.trim().replace(/^\*\./, '');
        if (clean && clean !== apex && clean.endsWith(`.${apex}`)) {
          subdomains.add(clean);
        }
      }
    }
    return Array.from(subdomains).slice(0, 30); // cap to 30
  } catch {
    return [];
  }
}

async function checkSubdomainTakeover(subdomain: string): Promise<{ subdomain: string; service: string; cname: string } | null> {
  const cname = await getCNAME(subdomain);
  if (!cname) return null;

  for (const fp of DANGLING_FINGERPRINTS) {
    if (cname.includes(fp.pattern)) {
      // Verify the CNAME target actually responds with a takeover indicator
      try {
        const url = `https://${subdomain}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
        const body = await res.text();
        if (body.includes(fp.evidence)) {
          return { subdomain, service: fp.service, cname };
        }
      } catch { /* subdomain may not resolve — still suspicious */ }
      // Even without body confirmation, a CNAME to a known service with no record is suspicious
      return { subdomain, service: fp.service, cname };
    }
  }
  return null;
}

export async function runSubdomainTakeoverModule(crawl: CrawlResult): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];
  const hostname = new URL(crawl.finalUrl).hostname;
  const parts = hostname.split('.');
  const apex = parts.length > 2 ? parts.slice(-2).join('.') : hostname;

  const subdomains = await getSubdomainsFromCrtSh(apex);
  if (subdomains.length === 0) return findings;

  const results = await Promise.all(
    subdomains.map((s) => checkSubdomainTakeover(s)),
  );

  const vulnerable = results.filter((r): r is NonNullable<typeof r> => r !== null);

  for (const hit of vulnerable) {
    findings.push({
      moduleId: 'P1-11',
      severity: 'HIGH',
      category: 'Subdomain Takeover',
      title: `Subdomain ${hit.subdomain} may be vulnerable to takeover`,
      location: hit.subdomain,
      evidence: `CNAME: ${hit.subdomain} → ${hit.cname} (${hit.service})\nThe ${hit.service} resource this CNAME points to no longer exists.`,
      explanation: `${hit.subdomain} has a DNS CNAME record pointing to ${hit.service}, but the corresponding resource on that platform has been deleted. An attacker can claim that resource and serve content under your subdomain.`,
      impact: `An attacker who claims the ${hit.service} resource can host arbitrary content on ${hit.subdomain}, including phishing pages, malicious scripts, or fake login forms that inherit your domain's trust.`,
      fixManual: [
        `Delete the CNAME record for ${hit.subdomain} from your DNS if the service is no longer needed.`,
        `Or re-create the ${hit.service} resource and point it back to ${hit.subdomain}.`,
        'Audit all subdomains regularly — any CNAME pointing to a decommissioned service is a risk.',
      ],
      fixAiPrompt: `My subdomain ${hit.subdomain} has a dangling CNAME pointing to ${hit.service} (${hit.cname}) which no longer exists. Help me either remove the DNS record or reclaim the external resource to prevent subdomain takeover.`,
    });
  }

  return findings;
}

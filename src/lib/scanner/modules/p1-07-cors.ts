import type { CrawlResult, RawFinding } from '../types';

const EVIL_ORIGIN = 'https://evil.attacker.example';

export async function runCorsModule(crawl: CrawlResult): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];

  // Probe the main URL and common API paths
  const urlsToProbe = [crawl.finalUrl];
  // If there are API-looking paths in the HTML, try a few
  const apiPathRe = /["'](\/api\/[^"'\s?#]{1,60})["']/g;
  let m: RegExpExecArray | null;
  const apiPaths: string[] = [];
  while ((m = apiPathRe.exec(crawl.html)) !== null && apiPaths.length < 3) {
    try { urlsToProbe.push(new URL(m[1], crawl.finalUrl).href); } catch { /* skip */ }
  }

  for (const probeUrl of urlsToProbe) {
    let res: Response;
    try {
      res = await fetch(probeUrl, {
        method: 'GET',
        headers: {
          'Origin': EVIL_ORIGIN,
          'User-Agent': 'VibeSafe-Scanner/1.0',
        },
        signal: AbortSignal.timeout(8_000),
      });
    } catch { continue; }

    const acao = res.headers.get('access-control-allow-origin') ?? '';
    const acac = res.headers.get('access-control-allow-credentials') ?? '';
    const path = new URL(probeUrl).pathname;

    if (acao === '*' && acac.toLowerCase() === 'true') {
      findings.push({
        moduleId: 'P1-07',
        severity: 'CRITICAL',
        category: 'CORS Misconfiguration',
        title: 'Wildcard CORS with credentials allowed',
        location: path,
        evidence: `Access-Control-Allow-Origin: *\nAccess-Control-Allow-Credentials: true`,
        explanation: 'CORS wildcard (*) combined with Allow-Credentials: true is rejected by browsers, but indicates the CORS policy is misconfigured and likely reflects arbitrary origins for other endpoints.',
        impact: 'Any website can make authenticated cross-origin requests to your API on behalf of your users.',
        fixManual: [
          'Never combine Access-Control-Allow-Origin: * with Access-Control-Allow-Credentials: true.',
          'Use an explicit allowlist of trusted origins instead of the wildcard.',
          'Validate the Origin header against the allowlist before reflecting it.',
        ],
        fixAiPrompt: `My API at ${path} has CORS wildcard with credentials. Implement a strict origin allowlist in my Next.js API route that only allows my own domain.`,
      });
      break;
    }

    if (acao === EVIL_ORIGIN) {
      const withCreds = acac.toLowerCase() === 'true';
      findings.push({
        moduleId: 'P1-07',
        severity: withCreds ? 'CRITICAL' : 'HIGH',
        category: 'CORS Misconfiguration',
        title: withCreds
          ? 'CORS reflects any origin with credentials allowed'
          : 'CORS reflects any origin without validation',
        location: path,
        evidence: [
          `Request Origin: ${EVIL_ORIGIN}`,
          `Access-Control-Allow-Origin: ${acao}`,
          withCreds ? `Access-Control-Allow-Credentials: true` : '',
        ].filter(Boolean).join('\n'),
        explanation: withCreds
          ? 'Your server reflects any Origin header back with credentials allowed. Any website can make authenticated API requests on behalf of your logged-in users.'
          : 'Your server reflects any Origin header without validation. While credentials are not allowed, this permits any site to read public API responses from your server.',
        impact: withCreds
          ? "Attackers can read users' private data and perform actions on their behalf from any domain."
          : 'Information leakage — any site can read your API responses.',
        fixManual: [
          'Maintain an explicit allowlist of permitted origins.',
          'Never reflect the request Origin header directly.',
          'Validate: `const allowed = ["https://yourdomain.com"]; if (allowed.includes(req.headers.origin)) ...`',
        ],
        fixAiPrompt: `My API at ${path} reflects any Origin header in CORS responses${withCreds ? ' and allows credentials' : ''}. Implement a strict origin allowlist in my Next.js API routes.`,
      });
      break; // one finding is enough
    }
  }

  return findings;
}

import type { CrawlResult, RawFinding } from '../types';

const EVIL_ORIGIN = 'https://evil.attacker.example';

export async function runCorsModule(crawl: CrawlResult): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];

  // Probe the main URL and up to 3 common API paths found in the HTML.
  const urlsToProbe = [crawl.finalUrl];
  const apiPathRe = /["'](\/api\/[^"'\s?#]{1,60})["']/g;
  let m: RegExpExecArray | null;
  // Cap at 4 total (1 main + 3 API): check urlsToProbe.length, not a separate
  // counter — the original apiPaths array never received pushes so the cap
  // was always 0 (never engaged). This is the corrected guard.
  while ((m = apiPathRe.exec(crawl.html)) !== null && urlsToProbe.length < 4) {
    try { urlsToProbe.push(new URL(m[1], crawl.finalUrl).href); } catch { /* skip */ }
  }

  // Track URLs that already produced a CRITICAL GET finding so the OPTIONS pass
  // can skip the origin-reflection check for them (no double-emit).
  const getCriticalUrls = new Set<string>();

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
      // Record CRITICAL and stop checking remaining URLs in the GET pass.
      // The wildcard finding already covers the full site; probing more URLs
      // would only add duplicate noise.
      getCriticalUrls.add(probeUrl);
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
      // Record CRITICAL URLs so the OPTIONS pass skips the origin-reflection
      // check for them. HIGH findings do not set this flag — the OPTIONS pass
      // may still surface a CRITICAL preflight finding for the same URL.
      if (withCreds) {
        getCriticalUrls.add(probeUrl);
      }
      // Do not break — continue probing other URLs in the GET pass so we can
      // accurately populate getCriticalUrls for every URL before the OPTIONS pass.
    }
  }

  // --- OPTIONS preflight pass ---
  // Send a preflight request to each URL. Two independent checks per URL:
  //   1. Origin-reflection (same logic as GET, but skip if GET already found CRITICAL).
  //   2. Method over-permissiveness (always checked, independent of GET results).
  for (const probeUrl of urlsToProbe) {
    // If the GET loop already found CRITICAL for this URL, skip the entire
    // OPTIONS probe — it would only produce redundant findings.
    if (getCriticalUrls.has(probeUrl)) continue;

    let res: Response;
    try {
      res = await fetch(probeUrl, {
        method: 'OPTIONS',
        headers: {
          'Origin': EVIL_ORIGIN,
          'Access-Control-Request-Method': 'DELETE',
          'Access-Control-Request-Headers': 'Authorization',
          'User-Agent': 'VibeSafe-Scanner/1.0',
        },
        signal: AbortSignal.timeout(8_000),
      });
    } catch { continue; } // Network errors silently skipped, matching GET probe pattern

    const acao = res.headers.get('access-control-allow-origin') ?? '';
    const acac = res.headers.get('access-control-allow-credentials') ?? '';
    const acam = res.headers.get('access-control-allow-methods') ?? '';
    const path = new URL(probeUrl).pathname;

    // Check 1: origin reflection (only when GET did not already produce CRITICAL/HIGH
    // for this URL — the getCriticalUrls guard above already filtered CRITICAL;
    // HIGH URLs are not in the set, so they can still get an OPTIONS CRITICAL here).
    if (acao === EVIL_ORIGIN) {
      const withCreds = acac.toLowerCase() === 'true';
      findings.push({
        moduleId: 'P1-07',
        severity: withCreds ? 'CRITICAL' : 'HIGH',
        category: 'CORS Misconfiguration',
        title: withCreds
          ? 'CORS preflight reflects any origin with credentials'
          : 'CORS preflight reflects any origin',
        location: path,
        evidence: [
          `Request Origin: ${EVIL_ORIGIN}`,
          `Access-Control-Allow-Origin: ${acao}`,
          withCreds ? `Access-Control-Allow-Credentials: true` : '',
        ].filter(Boolean).join('\n'),
        explanation: withCreds
          ? 'The server grants preflight approval to any origin with credentials. Attackers can make authenticated cross-origin requests from any domain.'
          : 'The server grants preflight approval to any origin. Any site can issue cross-origin requests to this endpoint.',
        impact: withCreds
          ? "Attackers can read users' private data and perform actions on their behalf from any domain."
          : 'Information leakage — any site can read your API responses via cross-origin requests.',
        fixManual: [
          'Maintain an explicit allowlist of permitted origins.',
          'Never reflect the request Origin header directly in preflight responses.',
          'Validate: `const allowed = ["https://yourdomain.com"]; if (allowed.includes(req.headers.origin)) ...`',
        ],
        fixAiPrompt: `My API at ${path} reflects any Origin in preflight CORS responses${withCreds ? ' and allows credentials' : ''}. Implement a strict origin allowlist in my Next.js API routes.`,
      });
    }

    // Check 2: method over-permissiveness — dangerous HTTP methods allowed on
    // a non-API path suggest the CORS policy was not scoped correctly.
    // This check is independent of origin reflection and fires even when the
    // GET probe found a HIGH finding for this URL.
    const destructiveMethods = ['DELETE', 'PUT', 'PATCH'];
    const allowsDestructive = destructiveMethods.some((method) =>
      acam.toUpperCase().split(/[\s,]+/).includes(method)
    );
    // Only flag non-API paths — /api/ routes are expected to expose these methods.
    if (allowsDestructive && !path.startsWith('/api/')) {
      findings.push({
        moduleId: 'P1-07',
        severity: 'MEDIUM',
        category: 'CORS Misconfiguration',
        title: 'Overpermissive CORS preflight: destructive methods allowed on non-API path',
        location: path,
        evidence: `Path: ${path}\nAccess-Control-Allow-Methods: ${acam}`,
        explanation:
          'The CORS preflight response permits DELETE, PUT, or PATCH on a path that does not appear to be an API endpoint. This is unusual and may indicate an overly broad CORS policy.',
        impact:
          'Cross-origin callers with a valid CORS approval can invoke destructive HTTP methods against this path.',
        fixManual: [
          'Restrict Access-Control-Allow-Methods to only the methods your endpoint actually needs.',
          'Apply destructive-method CORS permissions only to /api/ routes that require them.',
        ],
        fixAiPrompt: `My server allows DELETE/PUT/PATCH via CORS on non-API path ${path}. Tighten the Access-Control-Allow-Methods header to the minimum set needed.`,
      });
    }
  }

  return findings;
}

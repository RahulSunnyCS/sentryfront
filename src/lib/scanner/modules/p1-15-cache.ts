import type { CrawlResult, RawFinding } from '../types';

// Patterns that suggest a page or API response is likely authenticated / user-specific
const AUTH_INDICATORS = [
  /set-cookie/i,
  /authorization/i,
  /x-auth/i,
  /x-user/i,
  /x-account/i,
];

function looksAuthenticated(headers: Record<string, string>, cookies: CrawlResult['cookies']): boolean {
  // Has session cookies
  if (cookies.length > 0) return true;
  // Response has auth-related headers
  for (const [key] of Object.entries(headers)) {
    if (AUTH_INDICATORS.some((re) => re.test(key))) return true;
  }
  return false;
}

function parseCacheControl(value: string): Record<string, string | true> {
  const directives: Record<string, string | true> = {};
  for (const part of value.split(',')) {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx >= 0) {
      directives[trimmed.slice(0, eqIdx).toLowerCase().trim()] = trimmed.slice(eqIdx + 1).trim();
    } else {
      directives[trimmed.toLowerCase()] = true;
    }
  }
  return directives;
}

export function runCacheModule(crawl: CrawlResult): RawFinding[] {
  const findings: RawFinding[] = [];
  const cacheControl = crawl.headers['cache-control'] ?? '';
  const varyHeader = crawl.headers['vary'] ?? '';
  const isAuthenticated = looksAuthenticated(crawl.headers, crawl.cookies);

  if (!isAuthenticated) return findings; // cache checks only relevant for authenticated responses

  if (!cacheControl) {
    findings.push({
      moduleId: 'P1-15',
      severity: 'MEDIUM',
      category: 'Cache Configuration',
      title: 'No Cache-Control header on authenticated response',
      location: 'HTTP response headers',
      evidence: 'Cache-Control header absent on response that sets session cookies',
      explanation: 'Without Cache-Control headers, browsers and intermediate caches (CDNs, proxies) may cache authenticated page content. Subsequent users on shared computers or through shared caches may see another user\'s data.',
      impact: 'Sensitive page content may be served from browser or proxy cache to a different user.',
      fixManual: [
        'Add Cache-Control: no-store to all authenticated responses.',
        'In Next.js, set headers in your API routes or in next.config.js for page routes.',
        'Also set Pragma: no-cache for older HTTP/1.0 compatibility.',
      ],
      fixAiPrompt: 'My authenticated pages have no Cache-Control headers. Add Cache-Control: no-store, no-cache to all authenticated page and API responses in Next.js.',
    });
    return findings;
  }

  const directives = parseCacheControl(cacheControl);

  if (!directives['no-store'] && !directives['private']) {
    const hasNoCache = 'no-cache' in directives;
    findings.push({
      moduleId: 'P1-15',
      severity: hasNoCache ? 'LOW' : 'MEDIUM',
      category: 'Cache Configuration',
      title: 'Authenticated response may be cached by intermediaries',
      location: 'HTTP response headers',
      evidence: `Cache-Control: ${cacheControl}`,
      explanation: `The Cache-Control header on this authenticated response does not include \`no-store\` or \`private\`. ${hasNoCache ? '`no-cache` requires revalidation but the content may still be stored.' : 'The response may be stored by shared caches (CDNs, proxies).'}`,
      impact: 'Private user data may be stored in a shared cache and served to other users.',
      fixManual: [
        'Add no-store to Cache-Control to prevent any caching of sensitive responses.',
        `Recommended: Cache-Control: no-store, no-cache, must-revalidate`,
        'Use private if caching in the browser is acceptable but not on shared caches.',
      ],
      fixAiPrompt: `My authenticated responses use Cache-Control: ${cacheControl}. Update to Cache-Control: no-store to prevent caching of sensitive user data.`,
    });
  }

  if (isAuthenticated && !varyHeader.toLowerCase().includes('authorization') && !varyHeader.toLowerCase().includes('cookie') && !directives['no-store'] && !directives['private']) {
    findings.push({
      moduleId: 'P1-15',
      severity: 'LOW',
      category: 'Cache Configuration',
      title: 'Vary header missing Cookie/Authorization on authenticated response',
      location: 'HTTP response headers',
      evidence: `Vary: ${varyHeader || '(not set)'}`,
      explanation: 'When caching authenticated responses, the Vary header must include Cookie or Authorization so caches key responses per-user. Without it, one user\'s response may be served to another.',
      impact: 'A proxy or CDN may serve a cached response for user A to user B if their request looks identical.',
      fixManual: [
        'Add Vary: Cookie to responses that differ per session.',
        "Alternatively, set Cache-Control: private or no-store to opt out of shared caching entirely.",
      ],
      fixAiPrompt: 'My authenticated responses are missing Vary: Cookie. Add this header so caches correctly key responses per user session.',
    });
  }

  return findings;
}

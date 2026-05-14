import type { CrawlResult, RawFinding } from '../types';

// Phase 3.8.4 — P1-17: Service-Worker Security
//
// Service workers run cross-page and intercept network requests. Misconfiguration
// can amplify XSS impact (open fetch handler), broaden auth scope (over-broad
// registration scope), persist sensitive responses to cache, or pull in
// cross-origin code at runtime. None of these are catastrophic in isolation but
// together they're worth surfacing for any site that ships an SW.
//
// The module is read-only over `crawl.serviceWorkerRegistrations` and
// `crawl.serviceWorkerScripts`, both populated by the crawler in Phase 3.8.4.
// If either is absent the module is a no-op so flag-off scans are unchanged.

const SNIPPET_MAX = 200;

function clip(s: string, n = SNIPPET_MAX): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/**
 * Match an addEventListener('fetch', …) handler. We don't try to parse JS —
 * we just locate the listener and look at the next ~600 chars for telltale
 * markers of "blindly forward every request".
 */
function detectsBlindlyForwardingFetchHandler(script: string): { matched: string } | null {
  const re = /addEventListener\(\s*["']fetch["'][\s\S]{0,600}?respondWith\(\s*fetch\(/g;
  const m = re.exec(script);
  if (!m) return null;
  // Look at a wider window to see if the author origin-checks the request
  // before respondWith. If they do, suppress the finding.
  const windowStart = Math.max(0, m.index - 100);
  const windowEnd = Math.min(script.length, m.index + 800);
  const handlerWindow = script.slice(windowStart, windowEnd);
  const hasOriginCheck =
    /\borigin\s*[!=]==?/.test(handlerWindow) ||
    /URL\([^)]*\)\.origin/.test(handlerWindow) ||
    /self\.location\.origin/.test(handlerWindow);
  if (hasOriginCheck) return null;
  return { matched: clip(handlerWindow) };
}

function detectsCrossOriginImportScripts(
  script: string,
  swUrl: string,
): Array<{ url: string }> {
  const out: Array<{ url: string }> = [];
  const re = /importScripts\(\s*["'](https?:\/\/[^"']+)["']/g;
  let m: RegExpExecArray | null;
  let swOrigin: string;
  try { swOrigin = new URL(swUrl).origin; } catch { return []; }
  while ((m = re.exec(script)) !== null) {
    try {
      const scriptOrigin = new URL(m[1]).origin;
      if (scriptOrigin !== swOrigin) out.push({ url: m[1] });
    } catch { /* skip */ }
  }
  return out;
}

function detectsSensitiveHeaderCaching(script: string): { matched: string } | null {
  // Two-pass heuristic: find a .put( call on something that looks like a
  // cache, then check the surrounding ~600 chars for an Authorization or
  // Cookie reference. Both regexes are intentionally lax — this finding
  // fires at low confidence and the report copy makes that clear.
  const putRe = /\bcaches?\b[\s\S]{0,200}?\.put\(/g;
  let m: RegExpExecArray | null;
  while ((m = putRe.exec(script)) !== null) {
    const ctxStart = Math.max(0, m.index - 200);
    const ctxEnd = Math.min(script.length, m.index + m[0].length + 400);
    const ctx = script.slice(ctxStart, ctxEnd);
    if (/Authorization|Cookie/.test(ctx)) {
      return { matched: clip(ctx) };
    }
  }
  return null;
}

function isOverprivilegedScope(scope: string, pagePath: string): boolean {
  // Page URL path = the path component of crawl.finalUrl (e.g. '/app/users').
  // If the SW scope is shorter (more permissive) than the directory the page
  // lives in, flag it.
  if (!scope) return false;
  // Treat trailing slashes uniformly.
  const normalizedScope = scope.endsWith('/') ? scope : scope + '/';
  const pageDir = pagePath.endsWith('/')
    ? pagePath
    : pagePath.replace(/\/[^/]*$/, '/') || '/';
  // Scope '/' on a page at '/' is fine; scope '/' on a page at '/app/' is not.
  if (normalizedScope === '/' && pageDir !== '/') return true;
  return false;
}

export function runServiceWorkerModule(crawl: CrawlResult): RawFinding[] {
  const regs = crawl.serviceWorkerRegistrations;
  if (!regs || regs.length === 0) return [];
  const scripts = crawl.serviceWorkerScripts ?? {};

  const findings: RawFinding[] = [];
  const pagePath = (() => {
    try { return new URL(crawl.finalUrl).pathname; } catch { return '/'; }
  })();

  for (const reg of regs) {
    // Check 1: scope overreach — independent of script body, runs even when
    // we couldn't fetch the SW script.
    if (isOverprivilegedScope(reg.scope, pagePath)) {
      findings.push({
        moduleId: 'P1-17',
        severity: 'MEDIUM',
        category: 'Service Worker Security',
        title: 'Overprivileged service-worker scope',
        location: reg.url,
        evidence: `Page path: ${pagePath} · SW scope: ${reg.scope}`,
        explanation:
          'The service worker is registered with a broader scope than the page it lives in. A scope of "/" on a sub-path application gives the SW permission to intercept requests for the whole origin, including paths it has no business touching.',
        impact:
          'A bug or compromise in the SW can affect requests outside the application path it was intended to serve. Tighten the scope to the smallest path that covers the app.',
        fixManual: [
          `Register the service worker with an explicit scope option: navigator.serviceWorker.register('${reg.url}', { scope: '${pagePath}' }).`,
          'Ensure the Service-Worker-Allowed response header on the SW script matches the desired scope (or remove it if not needed).',
          'Audit the SW for any handlers that rely on intercepting cross-path requests.',
        ],
        fixAiPrompt: `My service worker at ${reg.url} is registered with scope "${reg.scope}" but the app lives at ${pagePath}. Help me tighten the registration scope to match the app path.`,
      });
    }

    const body = scripts[reg.url];
    if (!body) continue;

    // Check 2: open fetch handler — HIGH if no origin check.
    const openHandler = detectsBlindlyForwardingFetchHandler(body);
    if (openHandler) {
      findings.push({
        moduleId: 'P1-17',
        severity: 'HIGH',
        category: 'Service Worker Security',
        title: 'Service worker forwards arbitrary fetch requests without origin check',
        location: reg.url,
        evidence: openHandler.matched,
        explanation:
          "The service worker's fetch handler calls fetch(event.request) (or equivalent) without checking the request origin. If an attacker can induce the page (or any page in scope) to issue a request, the SW will forward it transparently — which can be used to amplify SSRF, smuggle Authorization headers, or bypass CORS checks performed at the application layer.",
        impact:
          'XSS or supply-chain compromises gain an extra primitive: any request the page can make, the SW will pass through. Tighten the handler to filter by origin and resource type before falling back to the network.',
        fixManual: [
          'Inside the fetch handler, check `new URL(event.request.url).origin === self.origin` (or your allowlist) before calling fetch(event.request).',
          'Restrict the handler to specific resource types or path prefixes — most apps only need to intercept their own static assets.',
          "If the SW only exists for offline caching, scope the listener to a Cache match-first strategy and don't blindly fetch when the cache misses.",
        ],
        fixAiPrompt: `My service worker at ${reg.url} forwards all fetch requests without an origin check. Help me add an allowlist that only passes requests to my own origin through to fetch().`,
      });
    }

    // Check 3: cross-origin importScripts (LOW — supply-chain hygiene).
    const crossOrigin = detectsCrossOriginImportScripts(body, reg.url);
    for (const co of crossOrigin) {
      findings.push({
        moduleId: 'P1-17',
        severity: 'LOW',
        category: 'Service Worker Security',
        title: 'Service worker imports cross-origin script without integrity guarantee',
        location: reg.url,
        evidence: `importScripts('${co.url}')`,
        explanation:
          'Service workers do not support Subresource Integrity (SRI). Any cross-origin script pulled in via importScripts() executes with full SW privilege the moment the upstream CDN is compromised or rotated.',
        impact:
          'A compromise of the imported CDN gives the attacker full control of the service worker — the SW can intercept and forge every request the page makes.',
        fixManual: [
          'Vendor the imported script in-tree and serve it from the same origin so a compromise of an external CDN cannot reach the SW.',
          'If you must use a CDN, pin to a specific immutable URL and monitor for upstream changes.',
        ],
        fixAiPrompt: `My service worker imports a cross-origin script from ${co.url}. Help me vendor this script in-tree so my SW does not depend on an external CDN.`,
      });
    }

    // Check 4: sensitive-header caching (MEDIUM, low-confidence heuristic).
    const headerCache = detectsSensitiveHeaderCaching(body);
    if (headerCache) {
      findings.push({
        moduleId: 'P1-17',
        severity: 'MEDIUM',
        category: 'Service Worker Security',
        title: 'Service worker may cache responses containing Authorization or Cookie headers',
        location: reg.url,
        evidence: headerCache.matched,
        explanation:
          'The service worker appears to put fetch responses into the cache while handling requests that carry Authorization or Cookie headers. Cached responses can leak across users or sessions if cache keys are not partitioned by credentials.',
        impact:
          'If two users share the SW cache and the cached response was tailored to the first user (auth cookie, bearer token), the second user could see the first user\'s data.',
        fixManual: [
          'Do not cache responses to authenticated requests in a shared cache, or partition the cache key by user identity.',
          'Strip Authorization / Cookie before caching, or skip the cache write entirely for credentialed requests.',
          'Audit the cache.put / caches.open call sites for credential-bearing responses.',
        ],
        fixAiPrompt: `My service worker at ${reg.url} caches responses that may carry Authorization or Cookie headers. Help me partition the cache key by user identity or skip caching for credentialed requests.`,
        confidence: 'low',
      });
    }
  }

  return findings;
}

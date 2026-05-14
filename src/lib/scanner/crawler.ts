import * as tls from 'tls';
import { chromium, type Browser, type Response as PlaywrightResponse } from 'playwright';
import type { CrawlResult, NetworkRequest, ParsedCookie, TLSCertInfo } from './types';
import { features } from '@/lib/features';
import { logger } from '@/lib/logger';
import { cleanHtml } from './tools/html-clean';

const FETCH_TIMEOUT_MS = 20_000;
const NAV_TIMEOUT_MS = 30_000;
const NETWORK_IDLE_TIMEOUT_MS = 8_000;
const MAX_JS_BUNDLES = 50;
const MAX_CHUNK_BYTES = 5_000_000;
const MAX_TOTAL_CHUNK_BYTES = 50_000_000;
const MAX_MANIFEST_CHUNKS = 80;

const USER_AGENT = 'VibeSafe-Scanner/1.0 (security audit; contact@vibesafe.io)';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}

function normalizeHeaders(raw: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  raw.forEach((value, key) => { out[key.toLowerCase()] = value; });
  return out;
}

function parseSetCookieStrings(raw: string[]): ParsedCookie[] {
  return raw.map((header) => {
    const parts = header.split(';').map((p) => p.trim());
    const [nameVal, ...attrs] = parts;
    const eqIdx = nameVal.indexOf('=');
    const name = eqIdx >= 0 ? nameVal.slice(0, eqIdx) : nameVal;
    const value = eqIdx >= 0 ? nameVal.slice(eqIdx + 1) : '';
    const attrMap = new Map(attrs.map((a) => {
      const i = a.indexOf('=');
      return i >= 0 ? [a.slice(0, i).toLowerCase(), a.slice(i + 1)] : [a.toLowerCase(), ''];
    }));
    return {
      name,
      value,
      secure: attrMap.has('secure'),
      httpOnly: attrMap.has('httponly'),
      sameSite: attrMap.get('samesite') ?? null,
      domain: attrMap.get('domain') ?? null,
      path: attrMap.get('path') ?? null,
    };
  });
}

function parseSetCookieHeaders(headers: Headers): ParsedCookie[] {
  return parseSetCookieStrings(headers.getSetCookie?.() ?? []);
}

function extractJsBundleUrls(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const urls: string[] = [];
  const re = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && urls.length < MAX_JS_BUNDLES) {
    try {
      const abs = new URL(m[1], base).href;
      if (abs.startsWith('http')) urls.push(abs);
    } catch { /* skip malformed */ }
  }
  return urls;
}

function extractInlineScripts(html: string): string {
  const parts: string[] = [];
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1].trim()) parts.push(m[1]);
  }
  return parts.join('\n');
}

function detectStack(headers: Record<string, string>, html: string): string {
  const server = headers['server'] ?? '';
  const via = headers['x-powered-by'] ?? '';
  const xVercel = headers['x-vercel-id'] ?? '';

  if (xVercel || headers['x-vercel-cache']) return 'Next.js on Vercel';
  if (via.toLowerCase().includes('next')) return 'Next.js';
  if (html.includes('__NUXT__')) return 'Nuxt.js';
  if (html.includes('ng-version') || html.includes('ng-app')) return 'Angular';
  if (html.includes('data-reactroot') || html.includes('__NEXT_DATA__')) return 'React';
  if (html.includes('__svelte')) return 'SvelteKit';
  if (server.toLowerCase().includes('cloudflare')) return 'Cloudflare Pages';
  if (headers['x-github-request-id']) return 'GitHub Pages';
  if (headers['x-netlify']) return 'Netlify';
  return 'Unknown';
}

async function getTLSInfo(hostname: string): Promise<TLSCertInfo | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 5_000);
    try {
      const socket = tls.connect({ host: hostname, port: 443, servername: hostname }, () => {
        clearTimeout(timer);
        const cert = socket.getPeerCertificate();
        const proto = socket.getProtocol?.() ?? null;
        const expiresAt = cert?.valid_to ? new Date(cert.valid_to) : null;
        const now = Date.now();
        const daysUntilExpiry = expiresAt
          ? Math.floor((expiresAt.getTime() - now) / 86_400_000)
          : null;
        resolve({
          valid: socket.authorized,
          protocol: proto,
          expiresAt,
          daysUntilExpiry,
          issuer: (Array.isArray(cert?.issuer?.O) ? cert.issuer.O[0] : cert?.issuer?.O) ?? null,
          subject: (Array.isArray(cert?.subject?.CN) ? cert.subject.CN[0] : cert?.subject?.CN) ?? null,
        });
        socket.destroy();
      });
      socket.once('error', () => { clearTimeout(timer); resolve(null); });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

async function probeTLS(finalUrl: string): Promise<TLSCertInfo | null> {
  try {
    const parsed = new URL(finalUrl);
    if (parsed.protocol === 'https:') {
      return await getTLSInfo(parsed.hostname);
    }
  } catch { /* non-HTTPS or bad URL */ }
  return null;
}

// ─── Framework-manifest probing (Strategy C) ─────────────────────────────────
//
// Probes well-known manifest paths for known frameworks and downloads any
// chunks they list that the browser didn't already load. Phase 3.1 covers
// Next.js and Vite, which together account for the vast majority of our
// AI-builder target audience. Nuxt / SvelteKit / Remix follow when telemetry
// shows value.

function extractNextManifestChunkPaths(manifestJs: string): string[] {
  // _buildManifest.js assigns `self.__BUILD_MANIFEST = { ... }`.
  // We don't eval — we regex out every "static/chunks/..." path string the
  // file mentions. Minified output keeps the literal path strings.
  const paths = new Set<string>();
  const re = /"((?:static\/(?:chunks|css)\/|\/_next\/static\/(?:chunks|css)\/)[\w/.@-]+\.(?:js|css))"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(manifestJs)) !== null) {
    paths.add(m[1]);
  }
  return Array.from(paths);
}

function extractViteManifestChunkPaths(manifestJson: string): string[] {
  try {
    const m = JSON.parse(manifestJson) as Record<string, { file?: string; css?: string[] }>;
    const paths = new Set<string>();
    for (const entry of Object.values(m)) {
      if (entry?.file && entry.file.endsWith('.js')) paths.add(entry.file);
    }
    return Array.from(paths);
  } catch {
    return [];
  }
}

async function fetchManifestChunks(
  baseUrl: string,
  stackHint: string,
  alreadyLoaded: Set<string>,
  bytesUsed: number,
): Promise<{ contents: Record<string, string>; bytesAdded: number }> {
  const base = new URL(baseUrl);
  const contents: Record<string, string> = {};
  let bytesAdded = 0;

  const manifestCandidates: { path: string; parser: (body: string) => string[] }[] = [];
  const lowerStack = stackHint.toLowerCase();

  if (lowerStack.includes('next')) {
    manifestCandidates.push({
      path: '/_next/static/chunks/_buildManifest.js',
      parser: extractNextManifestChunkPaths,
    });
  }
  // Vite default manifest location. Some setups also expose `.vite/manifest.json`.
  manifestCandidates.push({ path: '/manifest.json', parser: extractViteManifestChunkPaths });
  manifestCandidates.push({ path: '/.vite/manifest.json', parser: extractViteManifestChunkPaths });

  for (const { path, parser } of manifestCandidates) {
    let manifestUrl: string;
    try {
      manifestUrl = new URL(path, base).href;
    } catch {
      continue;
    }
    let manifestBody: string;
    try {
      const res = await withTimeout(
        fetch(manifestUrl, { headers: { 'User-Agent': USER_AGENT } }),
        5_000,
      );
      if (!res.ok) continue;
      manifestBody = await res.text();
    } catch {
      continue;
    }

    const chunkPaths = parser(manifestBody).slice(0, MAX_MANIFEST_CHUNKS);
    for (const rel of chunkPaths) {
      if (bytesUsed + bytesAdded >= MAX_TOTAL_CHUNK_BYTES) break;
      let chunkUrl: string;
      try {
        chunkUrl = new URL(rel, base).href;
      } catch {
        continue;
      }
      if (alreadyLoaded.has(chunkUrl)) continue;
      try {
        const res = await withTimeout(
          fetch(chunkUrl, { headers: { 'User-Agent': USER_AGENT } }),
          5_000,
        );
        if (!res.ok) continue;
        const body = await res.text();
        if (body.length > MAX_CHUNK_BYTES) continue;
        contents[chunkUrl] = body;
        alreadyLoaded.add(chunkUrl);
        bytesAdded += body.length;
      } catch {
        // ignore individual chunk failures
      }
    }
  }

  return { contents, bytesAdded };
}

// ─── Static-fetch crawl (fallback) ───────────────────────────────────────────

async function crawlWithFetch(targetUrl: string): Promise<CrawlResult> {
  const res = await withTimeout(
    fetch(targetUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
    }),
    FETCH_TIMEOUT_MS,
  );

  const html = await res.text();
  const headers = normalizeHeaders(res.headers);
  const cookies = parseSetCookieHeaders(res.headers);
  const finalUrl = res.url || targetUrl;
  const jsBundleUrls = extractJsBundleUrls(html, finalUrl);
  const inlineScriptContent = extractInlineScripts(html);
  const stack = detectStack(headers, html);
  const tlsInfo = await probeTLS(finalUrl);

  return {
    finalUrl,
    statusCode: res.status,
    headers,
    cookies,
    jsBundleUrls,
    inlineScriptContent,
    html,
    tls: tlsInfo,
    stack,
    cleanedHtml: cleanHtml(html),
    renderMode: 'fetch-only',
  };
}

// ─── Headless-rendered crawl (Strategy A + C) ────────────────────────────────

async function crawlWithPlaywright(targetUrl: string): Promise<CrawlResult> {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      ignoreHTTPSErrors: false,
    });
    const page = await context.newPage();

    const networkRequests: NetworkRequest[] = [];
    const consoleErrors: string[] = [];
    const loadedChunkContents: Record<string, string> = {};
    let chunkBytes = 0;

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    page.on('request', (req) => {
      networkRequests.push({
        url: req.url(),
        method: req.method(),
        resourceType: req.resourceType(),
        status: null,
        fromCache: false,
      });
    });

    const jsResponses: PlaywrightResponse[] = [];
    page.on('response', (res) => {
      const req = networkRequests.find((r) => r.url === res.url() && r.status === null);
      if (req) {
        req.status = res.status();
        req.fromCache = res.fromServiceWorker?.() ?? false;
      }
      if (res.request().resourceType() === 'script') {
        jsResponses.push(res);
      }
    });

    let documentResponse: PlaywrightResponse | null = null;
    try {
      documentResponse = await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: NAV_TIMEOUT_MS,
      });
    } catch (err) {
      // Navigation timeout or net error — keep going; we may still have a partial page.
      logger.warn('page.goto raised, continuing with whatever we have', {
        url: targetUrl,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Best-effort wait for network to settle so lazy chunks load.
    try {
      await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_TIMEOUT_MS });
    } catch {
      // proceed even if network never quiets — common on sites with long-polling.
    }

    const finalUrl = page.url() || targetUrl;
    const renderedHtml = await page.content();

    // Initial HTML + status + headers from the main-frame document response.
    let initialHtml = renderedHtml;
    let statusCode = 0;
    let headers: Record<string, string> = {};
    let cookies: ParsedCookie[] = [];

    if (documentResponse) {
      statusCode = documentResponse.status();
      const rawHeaders = documentResponse.headers();
      headers = Object.fromEntries(
        Object.entries(rawHeaders).map(([k, v]) => [k.toLowerCase(), v]),
      );
      try {
        initialHtml = await documentResponse.text();
      } catch {
        // body already consumed or unavailable — fall back to rendered.
        initialHtml = renderedHtml;
      }
      try {
        const headersArr = await documentResponse.headersArray();
        const setCookieStrings = headersArr
          .filter((h) => h.name.toLowerCase() === 'set-cookie')
          .map((h) => h.value);
        cookies = parseSetCookieStrings(setCookieStrings);
      } catch {
        cookies = [];
      }
    }

    // Download JS chunk bodies that the browser actually fetched.
    const loadedUrls = new Set<string>();
    for (const res of jsResponses) {
      if (chunkBytes >= MAX_TOTAL_CHUNK_BYTES) break;
      const url = res.url();
      if (loadedUrls.has(url)) continue;
      try {
        const body = await res.text();
        if (body.length > MAX_CHUNK_BYTES) continue;
        loadedChunkContents[url] = body;
        loadedUrls.add(url);
        chunkBytes += body.length;
      } catch {
        // body unavailable (e.g. blocked, redirect) — skip.
      }
    }

    // Derive remaining fields from the initial HTML for back-compat with
    // existing modules that read jsBundleUrls / inlineScriptContent / stack.
    const jsBundleUrls = extractJsBundleUrls(initialHtml, finalUrl);
    const inlineScriptContent = extractInlineScripts(initialHtml);
    const stack = detectStack(headers, initialHtml);

    // Strategy C: framework-manifest probe for chunks the browser didn't load.
    const manifest = await fetchManifestChunks(finalUrl, stack, loadedUrls, chunkBytes);
    Object.assign(loadedChunkContents, manifest.contents);
    chunkBytes += manifest.bytesAdded;

    const tlsInfo = await probeTLS(finalUrl);

    await context.close();
    return {
      finalUrl,
      statusCode,
      headers,
      cookies,
      jsBundleUrls,
      inlineScriptContent,
      html: initialHtml,
      tls: tlsInfo,
      stack,
      renderedHtml,
      consoleErrors,
      networkRequests,
      loadedChunkContents,
      cleanedHtml: cleanHtml(renderedHtml || initialHtml),
      renderMode: 'headless',
    };
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}

// ─── Public entry point ──────────────────────────────────────────────────────

export async function crawl(targetUrl: string): Promise<CrawlResult> {
  if (features.headlessCrawl) {
    try {
      return await crawlWithPlaywright(targetUrl);
    } catch (err) {
      logger.warn('Headless crawl failed, falling back to static fetch', {
        url: targetUrl,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return await crawlWithFetch(targetUrl);
}

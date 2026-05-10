import * as tls from 'tls';
import type { CrawlResult, ParsedCookie, TLSCertInfo } from './types';

const FETCH_TIMEOUT_MS = 20_000;
const MAX_JS_BUNDLES = 50;

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

function parseSetCookieHeaders(headers: Headers): ParsedCookie[] {
  const raw = headers.getSetCookie?.() ?? [];
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

export async function crawl(targetUrl: string): Promise<CrawlResult> {
  const res = await withTimeout(
    fetch(targetUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'VibeSafe-Scanner/1.0 (security audit; contact@vibesafe.io)' },
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

  let tlsInfo: TLSCertInfo | null = null;
  try {
    const parsed = new URL(finalUrl);
    if (parsed.protocol === 'https:') {
      tlsInfo = await getTLSInfo(parsed.hostname);
    }
  } catch { /* non-HTTPS or bad URL */ }

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
  };
}

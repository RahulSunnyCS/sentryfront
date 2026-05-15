/**
 * Extension scan pipeline — runs passive security modules against
 * pre-collected page artifacts from the Chrome extension.
 *
 * Skipped modules (require server-side network probing):
 *   P1-06 (sensitive paths), P1-07 (CORS probes),
 *   P1-10 (DNS email), P1-11 (subdomain takeover), P1-13 (dev interfaces)
 *
 * Server-side supplements performed here:
 *   TLS cert (P1-04), manifest JSON (P1-18), SW scripts (P1-17)
 */

import { probeTLS } from './crawler';
import { runSecretsModule } from './modules/p1-01-secrets';
import { runSourcemapsModule } from './modules/p1-02-sourcemaps';
import { runHeadersModule } from './modules/p1-03-headers';
import { runTLSModule } from './modules/p1-04-tls';
import { runCookiesModule } from './modules/p1-05-cookies';
import { runMixedContentModule } from './modules/p1-08-mixed-content';
import { runThirdPartyScriptsModule } from './modules/p1-09-third-party-scripts';
import { runErrorDisclosureModule } from './modules/p1-12-error-disclosure';
import { runRobotsSitemapModule } from './modules/p1-14-robots-sitemap';
import { runCacheModule } from './modules/p1-15-cache';
import { runClientDepsModule } from './modules/p1-16-client-deps';
import { runServiceWorkerModule } from './modules/p1-17-service-worker';
import { runWebManifestModule } from './modules/p1-18-web-manifest';
import type { CrawlResult, RawFinding } from './types';
import type { ExtensionScanInput } from '@/types/extension';
import { logger } from '@/lib/logger';

export interface ExtensionScannerResult {
  findings: RawFinding[];
  stack: string;
  moduleFindingCounts: Record<string, number>;
}

const SEVERITY_SCORE: Record<string, number> = {
  CRITICAL: 25, HIGH: 10, MEDIUM: 3, LOW: 1, INFO: 0,
};

export function computeGrade(findings: RawFinding[]): { grade: string; score: number } {
  const score = findings.reduce((s, f) => s + (SEVERITY_SCORE[f.severity] ?? 0), 0);
  const grade = score === 0 ? 'A'
    : score <= 5 ? 'B'
    : score <= 20 ? 'C'
    : score <= 50 ? 'D'
    : 'F';
  return { grade, score };
}

function detectStackFromHeaders(headers: Record<string, string>): string {
  const h = headers;
  if (h['x-powered-by']?.toLowerCase().includes('next.js')) return 'Next.js';
  if (h['x-vercel-id']) return 'Vercel';
  if (h['x-github-request-id']) return 'GitHub Pages';
  if (h['x-netlify']) return 'Netlify';
  if (h['x-amz-cf-id'] || h['x-amzn-requestid']) return 'AWS';
  if (h['x-powered-by']?.toLowerCase().includes('express')) return 'Express';
  if (h['x-drupal-cache'] || h['x-generator']?.toLowerCase().includes('drupal')) return 'Drupal';
  if (h['x-wp-total'] || h['x-pingback']) return 'WordPress';
  return 'Unknown';
}

async function fetchManifestFromHtml(
  html: string,
  baseUrl: string,
): Promise<{ manifestUrl: string; manifestJson: string } | null> {
  const match = html.match(/<link[^>]+rel=["']manifest["'][^>]+href=["']([^"']+)["']/i)
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']manifest["']/i);
  if (!match) return null;

  const href = match[1];
  let manifestUrl: string;
  try {
    manifestUrl = new URL(href, baseUrl).href;
  } catch {
    return null;
  }

  try {
    const res = await fetch(manifestUrl, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const manifestJson = await res.text();
    return { manifestUrl, manifestJson };
  } catch {
    return null;
  }
}

async function fetchSwScripts(
  registrations: Array<{ url: string; scope: string }>,
): Promise<Record<string, string>> {
  const scripts: Record<string, string> = {};
  await Promise.allSettled(
    registrations.map(async ({ url }) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
        if (res.ok) {
          const text = await res.text();
          scripts[url] = text.slice(0, 200_000); // 200 KB cap
        }
      } catch { /* non-fatal */ }
    }),
  );
  return scripts;
}

export async function runExtensionScanner(
  input: ExtensionScanInput,
): Promise<ExtensionScannerResult> {
  const stack = detectStackFromHeaders(input.headers);

  // Server-side supplements — fire in parallel
  const [tlsInfo, manifestResult, swScripts] = await Promise.allSettled([
    probeTLS(input.url),
    fetchManifestFromHtml(input.html, input.url),
    fetchSwScripts(input.serviceWorkerRegistrations ?? []),
  ]);

  const crawlResult: CrawlResult = {
    finalUrl: input.url,
    statusCode: input.statusCode,
    headers: input.headers,
    cookies: input.cookies,
    jsBundleUrls: input.jsBundleUrls,
    inlineScriptContent: input.inlineScriptContent,
    html: input.html,
    tls: tlsInfo.status === 'fulfilled' ? tlsInfo.value : null,
    stack,
    renderMode: 'fetch-only',
    serviceWorkerRegistrations: input.serviceWorkerRegistrations,
    serviceWorkerScripts: swScripts.status === 'fulfilled' ? swScripts.value : undefined,
    manifestUrl: manifestResult.status === 'fulfilled' ? manifestResult.value?.manifestUrl : undefined,
    manifestJson: manifestResult.status === 'fulfilled' ? manifestResult.value?.manifestJson : undefined,
  };

  logger.info('Extension pipeline: running modules', { url: input.url, stack });

  // Async I/O modules
  const [
    secretsFindings,
    sourcemapFindings,
    errorDisclosureFindings,
    robotsSitemapFindings,
    clientDepsFindings,
  ] = await Promise.all([
    runSecretsModule(crawlResult),
    runSourcemapsModule(crawlResult),
    runErrorDisclosureModule(crawlResult),
    runRobotsSitemapModule(crawlResult),
    runClientDepsModule(crawlResult),
  ]);

  // Sync modules
  const headerFindings = runHeadersModule(crawlResult);
  const tlsFindings = runTLSModule(crawlResult);
  const cookieFindings = runCookiesModule(crawlResult);
  const mixedContentFindings = runMixedContentModule(crawlResult);
  const thirdPartyFindings = runThirdPartyScriptsModule(crawlResult);
  const cacheFindings = runCacheModule(crawlResult);
  const serviceWorkerFindings = runServiceWorkerModule(crawlResult);
  const webManifestFindings = runWebManifestModule(crawlResult);

  const allFindings: Array<{ id: string; findings: RawFinding[] }> = [
    { id: 'P1-01', findings: secretsFindings },
    { id: 'P1-02', findings: sourcemapFindings },
    { id: 'P1-03', findings: headerFindings },
    { id: 'P1-04', findings: tlsFindings },
    { id: 'P1-05', findings: cookieFindings },
    { id: 'P1-08', findings: mixedContentFindings },
    { id: 'P1-09', findings: thirdPartyFindings },
    { id: 'P1-12', findings: errorDisclosureFindings },
    { id: 'P1-14', findings: robotsSitemapFindings },
    { id: 'P1-15', findings: cacheFindings },
    { id: 'P1-16', findings: clientDepsFindings },
    { id: 'P1-17', findings: serviceWorkerFindings },
    { id: 'P1-18', findings: webManifestFindings },
  ];

  const findings = allFindings.flatMap((m) => m.findings);
  const moduleFindingCounts = Object.fromEntries(
    allFindings.map((m) => [m.id, m.findings.length]),
  );

  logger.info('Extension pipeline: complete', {
    url: input.url,
    findingCount: findings.length,
    moduleFindingCounts,
  });

  return { findings, stack, moduleFindingCounts };
}

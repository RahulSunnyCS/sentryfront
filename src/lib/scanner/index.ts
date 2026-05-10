import { crawl } from './crawler';
import { runSecretsModule } from './modules/p1-01-secrets';
import { runSourcemapsModule } from './modules/p1-02-sourcemaps';
import { runHeadersModule } from './modules/p1-03-headers';
import { runTLSModule } from './modules/p1-04-tls';
import { runCookiesModule } from './modules/p1-05-cookies';
import { runSensitivePathsModule } from './modules/p1-06-sensitive-paths';
import { runCorsModule } from './modules/p1-07-cors';
import { runMixedContentModule } from './modules/p1-08-mixed-content';
import { runThirdPartyScriptsModule } from './modules/p1-09-third-party-scripts';
import { runDnsEmailModule } from './modules/p1-10-dns-email';
import { runSubdomainTakeoverModule } from './modules/p1-11-subdomain-takeover';
import { runErrorDisclosureModule } from './modules/p1-12-error-disclosure';
import { runDevInterfacesModule } from './modules/p1-13-dev-interfaces';
import { runRobotsSitemapModule } from './modules/p1-14-robots-sitemap';
import { runCacheModule } from './modules/p1-15-cache';
import type { RawFinding } from './types';

export interface ScannerResult {
  findings: RawFinding[];
  stack: string;
  moduleFindingCounts: Record<string, number>;
}

export async function runScanner(targetUrl: string): Promise<ScannerResult> {
  const crawlResult = await crawl(targetUrl);

  // Group 1: async I/O-heavy modules — run fully in parallel
  const [
    secretsFindings,
    sourcemapFindings,
    sensitivePathFindings,
    corsFindings,
    dnsEmailFindings,
    subdomainFindings,
    errorDisclosureFindings,
    devInterfaceFindings,
    robotsSitemapFindings,
  ] = await Promise.all([
    runSecretsModule(crawlResult),
    runSourcemapsModule(crawlResult),
    runSensitivePathsModule(crawlResult),
    runCorsModule(crawlResult),
    runDnsEmailModule(crawlResult),
    runSubdomainTakeoverModule(crawlResult),
    runErrorDisclosureModule(crawlResult),
    runDevInterfacesModule(crawlResult),
    runRobotsSitemapModule(crawlResult),
  ]);

  // Group 2: synchronous modules — no extra I/O needed
  const headerFindings = runHeadersModule(crawlResult);
  const tlsFindings = runTLSModule(crawlResult);
  const cookieFindings = runCookiesModule(crawlResult);
  const mixedContentFindings = runMixedContentModule(crawlResult);
  const thirdPartyFindings = runThirdPartyScriptsModule(crawlResult);
  const cacheFindings = runCacheModule(crawlResult);

  const allFindings: Array<{ id: string; findings: RawFinding[] }> = [
    { id: 'P1-01', findings: secretsFindings },
    { id: 'P1-02', findings: sourcemapFindings },
    { id: 'P1-03', findings: headerFindings },
    { id: 'P1-04', findings: tlsFindings },
    { id: 'P1-05', findings: cookieFindings },
    { id: 'P1-06', findings: sensitivePathFindings },
    { id: 'P1-07', findings: corsFindings },
    { id: 'P1-08', findings: mixedContentFindings },
    { id: 'P1-09', findings: thirdPartyFindings },
    { id: 'P1-10', findings: dnsEmailFindings },
    { id: 'P1-11', findings: subdomainFindings },
    { id: 'P1-12', findings: errorDisclosureFindings },
    { id: 'P1-13', findings: devInterfaceFindings },
    { id: 'P1-14', findings: robotsSitemapFindings },
    { id: 'P1-15', findings: cacheFindings },
  ];

  const findings = allFindings.flatMap((m) => m.findings);
  const moduleFindingCounts = Object.fromEntries(
    allFindings.map((m) => [m.id, m.findings.length]),
  );

  return { findings, stack: crawlResult.stack, moduleFindingCounts };
}

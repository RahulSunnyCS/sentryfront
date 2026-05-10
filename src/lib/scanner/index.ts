import { crawl } from './crawler';
import { runSecretsModule } from './modules/p1-01-secrets';
import { runSourcemapsModule } from './modules/p1-02-sourcemaps';
import { runHeadersModule } from './modules/p1-03-headers';
import { runTLSModule } from './modules/p1-04-tls';
import { runCookiesModule } from './modules/p1-05-cookies';
import type { RawFinding } from './types';

export interface ScannerResult {
  findings: RawFinding[];
  stack: string;
  moduleFindingCounts: Record<string, number>;
}

export async function runScanner(targetUrl: string): Promise<ScannerResult> {
  const crawlResult = await crawl(targetUrl);

  // P1-01 requires async bundle fetching; run it concurrently with the sync modules
  const [secretsFindings, sourcemapFindings] = await Promise.all([
    runSecretsModule(crawlResult),
    runSourcemapsModule(crawlResult),
  ]);

  const headerFindings = runHeadersModule(crawlResult);
  const tlsFindings = runTLSModule(crawlResult);
  const cookieFindings = runCookiesModule(crawlResult);

  const findings: RawFinding[] = [
    ...secretsFindings,
    ...sourcemapFindings,
    ...headerFindings,
    ...tlsFindings,
    ...cookieFindings,
  ];

  const moduleFindingCounts: Record<string, number> = {
    'P1-01': secretsFindings.length,
    'P1-02': sourcemapFindings.length,
    'P1-03': headerFindings.length,
    'P1-04': tlsFindings.length,
    'P1-05': cookieFindings.length,
  };

  return { findings, stack: crawlResult.stack, moduleFindingCounts };
}

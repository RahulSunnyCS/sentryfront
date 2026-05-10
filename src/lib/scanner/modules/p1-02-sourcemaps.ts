import type { CrawlResult, RawFinding } from '../types';

async function mapFileAccessible(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}.map`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8_000),
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

export async function runSourcemapsModule(crawl: CrawlResult): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];
  const exposed: string[] = [];

  const results = await Promise.all(
    crawl.jsBundleUrls.slice(0, 20).map(async (url) => ({ url, accessible: await mapFileAccessible(url) })),
  );

  for (const { url, accessible } of results) {
    if (accessible) {
      const path = url.replace(/^https?:\/\/[^/]+/, '');
      exposed.push(`${path}.map`);
    }
  }

  if (exposed.length > 0) {
    findings.push({
      moduleId: 'P1-02',
      severity: 'HIGH',
      category: 'Sourcemap Exposure',
      title: `Production sourcemaps expose full source code (${exposed.length} file${exposed.length > 1 ? 's' : ''})`,
      location: exposed.join(', '),
      evidence: `HEAD ${exposed[0]} → HTTP 200`,
      explanation: 'Sourcemap files (.map) map compiled JavaScript back to your original source code. When these are publicly accessible in production, anyone can read your unminified TypeScript/JSX, including business logic, component names, and file structure.',
      impact: 'Attackers can read your original source to find additional vulnerabilities, understand authentication flows, and discover internal API endpoints.',
      fixManual: [
        'In Next.js, set productionBrowserSourceMaps: false in next.config.js.',
        'Redeploy after making the change — existing .map files are still cached.',
        'Verify by running: curl -I <your-bundle-url>.map (should return 404).',
      ],
      fixAiPrompt: 'My production Next.js build serves .map sourcemap files publicly. Set productionBrowserSourceMaps: false in next.config.js, redeploy, and verify .map files return 404.',
    });
  }

  return findings;
}

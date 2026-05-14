import type { CrawlResult, RawFinding } from '../types';

const SENSITIVE_PATH_PATTERNS = [
  /\/admin/i, /\/internal/i, /\/private/i, /\/secret/i, /\/backup/i,
  /\/debug/i, /\/test/i, /\/staging/i, /\/dev\b/i, /\/config/i,
  // Phase 3.5: anchor /api/v\d to the API root itself so `/api/v2/docs`,
  // `/api/v1/health`, etc. (legitimately public subpaths) stop matching.
  // Only `/api/v2`, `/api/v2/` (i.e. the root of a versioned API) is the
  // robots.txt-disclosure concern.
  /\/api\/v\d+\/?$/i, /\/api\/internal/i, /\/graphql/i, /\/dashboard/i,
  /\/\.env/i, /\/wp-admin/i, /\/phpmyadmin/i, /\/cgi-bin/i,
];

function isSensitivePath(path: string): boolean {
  return SENSITIVE_PATH_PATTERNS.some((re) => re.test(path));
}

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return '';
    return res.text();
  } catch {
    return '';
  }
}

function parseRobotsDisallow(content: string): string[] {
  const paths: string[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith('disallow:')) {
      const path = trimmed.slice('disallow:'.length).trim().split('#')[0].trim();
      if (path && path !== '/') paths.push(path);
    }
  }
  return paths;
}

function parseSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  const re = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    try {
      const url = new URL(m[1].trim());
      urls.push(url.pathname);
    } catch { /* skip */ }
  }
  return urls;
}

export async function runRobotsSitemapModule(crawl: CrawlResult): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];
  const base = new URL(crawl.finalUrl).origin;

  const [robotsTxt, sitemapXml] = await Promise.all([
    fetchText(`${base}/robots.txt`),
    fetchText(`${base}/sitemap.xml`),
  ]);

  // Robots.txt analysis
  if (robotsTxt) {
    const disallowed = parseRobotsDisallow(robotsTxt);
    const sensitivePaths = disallowed.filter(isSensitivePath);

    if (sensitivePaths.length > 0) {
      findings.push({
        moduleId: 'P1-14',
        severity: 'LOW',
        category: 'robots.txt & Sitemap',
        title: `robots.txt reveals ${sensitivePaths.length} sensitive path${sensitivePaths.length > 1 ? 's' : ''}`,
        location: '/robots.txt',
        evidence: `Disallow entries:\n${sensitivePaths.map((p) => `Disallow: ${p}`).join('\n')}`,
        explanation: 'robots.txt Disallow entries are intended to prevent search engine indexing, but they have the opposite effect on attackers — they act as a roadmap to paths you want to hide. Any attacker checks robots.txt first.',
        impact: 'Attackers learn about internal, admin, or sensitive paths without any scanning effort.',
        fixManual: [
          'Remove sensitive paths from robots.txt.',
          'Protect those endpoints with authentication instead of relying on obscurity.',
          'robots.txt is public — it cannot substitute for access controls.',
        ],
        fixAiPrompt: `My robots.txt Disallow entries reveal sensitive paths: ${sensitivePaths.join(', ')}. Remove these from robots.txt and add proper authentication to protect those endpoints.`,
      });
    }

    // Check if robots.txt blocks all crawlers on a public site.
    // The Disallow line must be exactly "/", not a prefix like "/admin" — match
    // a whole line so e.g. `Disallow: /admin` doesn't trip the substring check.
    const blocksAll = /^\s*Disallow:\s*\/\s*(?:#.*)?$/m.test(robotsTxt);
    const wildcardUA = /^\s*User-agent:\s*\*\s*(?:#.*)?$/m.test(robotsTxt);
    if (blocksAll && wildcardUA) {
      findings.push({
        moduleId: 'P1-14',
        severity: 'INFO',
        category: 'robots.txt & Sitemap',
        title: 'robots.txt blocks all search engine crawlers',
        location: '/robots.txt',
        evidence: robotsTxt.slice(0, 200),
        explanation: "Your robots.txt prevents all search engines from indexing any part of your site. If this is intentional (private app, beta), this is fine. If this is a public site, you are blocking organic SEO.",
        impact: 'No SEO impact if intentional. Unintentional on a public site means no search engine visibility.',
        fixManual: [
          'If this is intentional (private app), no action needed.',
          'If this is a public site, update robots.txt to allow crawling of public pages.',
        ],
        fixAiPrompt: "My robots.txt blocks all crawlers with 'Disallow: /'. If this is a public site, update robots.txt to allow search engines to crawl public pages.",
      });
    }
  }

  // Sitemap analysis
  if (sitemapXml) {
    const paths = parseSitemapUrls(sitemapXml);
    const sensitiveSitemapPaths = paths.filter(isSensitivePath);

    if (sensitiveSitemapPaths.length > 0) {
      findings.push({
        moduleId: 'P1-14',
        severity: 'LOW',
        category: 'robots.txt & Sitemap',
        title: `sitemap.xml includes ${sensitiveSitemapPaths.length} potentially sensitive path${sensitiveSitemapPaths.length > 1 ? 's' : ''}`,
        location: '/sitemap.xml',
        evidence: sensitiveSitemapPaths.slice(0, 5).join('\n'),
        explanation: 'Your sitemap.xml includes paths that appear to be internal, admin, or test pages. Sitemap files are designed to help search engines, but also help attackers discover pages.',
        impact: 'Attackers discover internal pages more quickly.',
        fixManual: [
          'Remove non-public pages from sitemap.xml.',
          'Ensure admin and internal pages are protected by authentication.',
        ],
        fixAiPrompt: `My sitemap.xml includes these sensitive-looking paths: ${sensitiveSitemapPaths.join(', ')}. Remove them from the sitemap and ensure they are protected by authentication.`,
      });
    }
  }

  return findings;
}

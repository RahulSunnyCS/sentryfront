import type { CrawlResult, RawFinding } from '../types';
import { runHttpxProbe } from '../tools/httpx';
import { runNuclei } from '../tools/nuclei';

const SENSITIVE_PATHS = [
  // Secrets & config
  '/.env', '/.env.local', '/.env.production', '/.env.backup',
  '/config.json', '/config.yaml', '/config.yml', '/config.php',
  '/settings.json', '/appsettings.json', '/web.config',
  // Git / VCS
  '/.git/config', '/.git/HEAD', '/.gitignore', '/.svn/entries',
  // Database & backups
  '/backup.sql', '/dump.sql', '/database.sql', '/db.sqlite',
  '/backup.zip', '/backup.tar.gz', '/www.zip',
  // Admin & dashboards
  '/admin', '/admin/login', '/administrator', '/wp-admin',
  '/dashboard', '/panel', '/controlpanel', '/cpanel',
  // API docs
  '/swagger', '/swagger-ui', '/swagger-ui.html', '/api-docs',
  '/openapi.json', '/openapi.yaml', '/graphql',
  // Framework debug
  '/_profiler', '/__debug__', '/actuator', '/actuator/health',
  '/actuator/env', '/debug', '/trace',
  // Common exposed files
  '/server-status', '/server-info', '/phpinfo.php',
  '/info.php', '/test.php', '/install.php',
  // Package files
  '/package.json', '/composer.json', '/Gemfile',
  '/requirements.txt', '/Pipfile',
  // Well-known
  '/.well-known/security.txt',
];

// Status codes that indicate the path exists (not cleanly blocked)
const SUSPICIOUS_CODES = new Set([200, 206, 301, 302, 307, 308, 401, 403, 500]);
// Codes that definitively mean "not there"
const NOT_FOUND_CODES = new Set([404, 410]);

interface Baseline { status: number; bodyHash: number; bodyLength: number }
interface ProbeResult { path: string; status: number }

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < Math.min(s.length, 2000); i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

async function getBaseline(baseUrl: string): Promise<Baseline> {
  try {
    const url = new URL('/vibesafe-probe-nonexistent-path-check', baseUrl).href;
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8_000),
      headers: { 'User-Agent': 'VibeSafe-Scanner/1.0' },
    });
    const body = await res.text();
    return { status: res.status, bodyHash: simpleHash(body), bodyLength: body.length };
  } catch {
    return { status: 404, bodyHash: 0, bodyLength: 0 };
  }
}

async function probeOne(baseUrl: string, path: string, baseline: Baseline): Promise<ProbeResult | null> {
  const url = new URL(path, baseUrl).href;
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(8_000),
      headers: { 'User-Agent': 'VibeSafe-Scanner/1.0' },
    });
    const body = await res.text();
    const status = res.status;

    if (NOT_FOUND_CODES.has(status)) return null;
    if (!SUSPICIOUS_CODES.has(status)) return null;

    // Compare with baseline: if same status + similar body → catch-all, not a real hit
    if (status === baseline.status) {
      const bodyHash = simpleHash(body);
      if (bodyHash === baseline.bodyHash) return null; // identical body
      // Allow ±20% body length difference as a fuzzy match
      const lengthRatio = body.length / (baseline.bodyLength || 1);
      if (lengthRatio > 0.8 && lengthRatio < 1.2 && Math.abs(bodyHash - baseline.bodyHash) < 100_000) {
        return null;
      }
    }

    return { path, status };
  } catch {
    return null;
  }
}

export async function runSensitivePathsModule(crawl: CrawlResult): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];

  // Establish baseline before probing (catches catch-all 200 sites like example.com)
  const baseline = await getBaseline(crawl.finalUrl);

  // Use httpx for fast parallel probing when available, fall back to fetch batches
  const httpxResults = await runHttpxProbe(crawl.finalUrl, SENSITIVE_PATHS);
  const hits: ProbeResult[] = [];

  if (httpxResults.length > 0) {
    // Validate httpx hits against baseline to remove false positives
    const validated = await Promise.all(
      httpxResults.map((r) => probeOne(crawl.finalUrl, r.path, baseline)),
    );
    for (const r of validated) { if (r) hits.push(r); }
  } else {
    // Fallback: fetch-based probing in batches of 10
    for (let i = 0; i < SENSITIVE_PATHS.length; i += 10) {
      const batch = SENSITIVE_PATHS.slice(i, i + 10);
      const results = await Promise.all(batch.map((p) => probeOne(crawl.finalUrl, p, baseline)));
      for (const r of results) { if (r) hits.push(r); }
    }
  }

  // Run nuclei for template-based detection (if installed + templates downloaded)
  const nucleiFindings = await runNuclei(crawl.finalUrl);
  findings.push(...nucleiFindings);

  if (hits.length === 0) return findings;

  // Separate critical hits from informational ones
  const criticalPaths = ['.env', '.git/config', '.git/HEAD', 'backup.sql', 'dump.sql', 'database.sql', 'db.sqlite', 'backup.zip'];
  const critical = hits.filter((h) => criticalPaths.some((c) => h.path.includes(c)));
  const others = hits.filter((h) => !criticalPaths.some((c) => h.path.includes(c)));

  for (const hit of critical) {
    findings.push({
      moduleId: 'P1-06',
      severity: 'CRITICAL',
      category: 'Sensitive Path Exposure',
      title: `Sensitive file publicly accessible: ${hit.path}`,
      location: hit.path,
      evidence: `GET ${hit.path} → HTTP ${hit.status}`,
      explanation: `The file ${hit.path} is publicly accessible. This type of file commonly contains secrets, credentials, or database contents that should never be exposed.`,
      impact: 'Depending on file contents: full credential exposure, database access, or complete source code leak.',
      fixManual: [
        `Block access to ${hit.path} immediately via your hosting platform or CDN.`,
        'Audit the file for any credentials and rotate them immediately.',
        'Add the path to your deny-list in vercel.json, nginx.conf, or equivalent.',
        'Verify the fix: the path should return 404, not 403.',
      ],
      fixAiPrompt: `The file ${hit.path} is publicly accessible on my site. Configure my hosting to return 404 for this path and audit for any secrets that may have been exposed.`,
    });
  }

  if (others.length > 0) {
    const list = others.map((h) => `${h.path} (HTTP ${h.status})`).join(', ');
    findings.push({
      moduleId: 'P1-06',
      severity: 'HIGH',
      category: 'Sensitive Path Exposure',
      title: `${others.length} sensitive path${others.length > 1 ? 's' : ''} returned non-404 responses`,
      location: others.map((h) => h.path).join(', '),
      evidence: list,
      explanation: 'Several paths that are typically hidden or admin-only returned non-404 status codes, indicating they may be accessible or discoverable.',
      impact: 'Admin panels, API docs, or debug interfaces may be accessible to unauthenticated users.',
      fixManual: [
        'Review each flagged path and determine whether it should be publicly accessible.',
        'Add authentication to any admin or debug interfaces.',
        'Return 404 (not 403) for paths that should not exist — 403 confirms the path exists.',
      ],
      fixAiPrompt: `These paths on my site are accessible but should not be: ${others.map((h) => h.path).join(', ')}. Help me restrict access using middleware or hosting configuration.`,
    });
  }

  return findings;
}

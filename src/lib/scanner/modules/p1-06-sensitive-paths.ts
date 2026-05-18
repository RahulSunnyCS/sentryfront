import type { CrawlResult, RawFinding } from '../types';
import { runHttpxProbe } from '../tools/httpx';
import { runNuclei } from '../tools/nuclei';
import { features } from '@/lib/features';

const BASE_SENSITIVE_PATHS = [
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

// Phase 3.8.2: coverage-gap path additions. Seed list cross-checked against
// SecLists Discovery/Web-Content/sensitive-files.txt (MIT). Each path is
// classified into a severity tier downstream — see CRITICAL_PATHS / MEDIUM_PATHS.
const PATHS_3_8_2 = [
  // VCS source-code disclosure (CRITICAL — full repo dump in the worst case)
  '/.git/index', '/.svn/wc.db', '/CVS/Root', '/CVS/Entries', '/.hg/store',
  // OS / editor metadata (HIGH — path disclosure, leaks adjacent file names)
  '/.DS_Store', '/Thumbs.db',
  // Backup variants (CRITICAL when present — they leak secrets verbatim)
  '/index.html.bak', '/index.php.bak', '/wp-config.php.bak',
  '/.env.bak', '/.env.old', '/.env.swp',
  // Dependency lockfiles (MEDIUM — version pinning becomes public, feeds P1-16)
  '/yarn.lock', '/package-lock.json', '/Gemfile.lock',
];

const SENSITIVE_PATHS = [
  ...BASE_SENSITIVE_PATHS,
  ...(features.pathCoverageChecks ? PATHS_3_8_2 : []),
];

// Substring matchers used for severity tiering. `.git/index` and `.svn/wc.db`
// are placed in CRITICAL_PATHS so they get the source-code-disclosure copy
// rather than the generic "admin panel" copy that the HIGH tier uses.
const CRITICAL_PATHS = [
  '.env', '.git/config', '.git/HEAD', '.git/index',
  '.svn/wc.db', '.hg/store',
  'backup.sql', 'dump.sql', 'database.sql', 'db.sqlite', 'backup.zip',
  // Backup variants matched via suffix below — kept in this list as substrings
  // for the existing `.includes()` check.
  '.env.bak', '.env.old', '.env.swp',
  'wp-config.php.bak', 'index.php.bak', 'index.html.bak',
];

const MEDIUM_PATHS = ['/yarn.lock', '/package-lock.json', '/Gemfile.lock'];

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

// Phase 3.5: a 200 response whose body is a login challenge means the
// path is properly gated, not exposed. Detect any of:
//   - a password input field
//   - a form posting to /login, /signin, /signon, or /auth
// Scan only the first 30 KB — login forms live above the fold.
const LOGIN_FORM_PATTERNS: RegExp[] = [
  /<input[^>]*type=["']?password\b/i,
  /<input[^>]*name=["']?password\b/i,
  /<form[^>]*action=["'][^"']*(?:login|signin|signon|auth)\b/i,
];

function looksLikeLoginChallenge(body: string): boolean {
  const head = body.slice(0, 30_000);
  return LOGIN_FORM_PATTERNS.some((re) => re.test(head));
}

// Phase 3.8.2: magic-byte sniffers to suppress SPA-catchall FPs on binary paths.
// A real `.DS_Store` starts with `\x00\x00\x00\x01Bud1`. A real `.git/index`
// starts with the ASCII signature `DIRC`. A 200 response missing the signature
// is almost always a catch-all HTML response, not the real binary.
function looksLikeDSStore(body: string): boolean {
  return body.length >= 8 && body.charCodeAt(0) === 0 && body.charCodeAt(1) === 0
    && body.charCodeAt(2) === 0 && body.charCodeAt(3) === 1
    && body.slice(4, 8) === 'Bud1';
}

function looksLikeGitIndex(body: string): boolean {
  return body.startsWith('DIRC');
}

function pathRequiresMagicByteMatch(path: string): ((body: string) => boolean) | null {
  if (path.endsWith('/.DS_Store')) return looksLikeDSStore;
  if (path.endsWith('/.git/index')) return looksLikeGitIndex;
  return null;
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

    // Phase 3.5: a properly-gated admin page returns 200 with a login
    // form. That's not exposure — suppress.
    if (status === 200 && looksLikeLoginChallenge(body)) return null;

    // Phase 3.8.2: binary-file paths must match their magic bytes. A 200
    // on /.DS_Store with HTML in the body is a catch-all, not exposure.
    if (status === 200) {
      const magic = pathRequiresMagicByteMatch(path);
      if (magic && !magic(body)) return null;
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

  // Severity tiering: CRITICAL hits get per-path detailed findings, MEDIUM
  // lockfile hits get a single combined finding (don't flood the report when
  // a project ships all three lockfiles), and everything else falls to HIGH.
  const critical = hits.filter((h) => CRITICAL_PATHS.some((c) => h.path.includes(c)));
  const medium = hits.filter((h) => MEDIUM_PATHS.includes(h.path));
  const others = hits.filter(
    (h) =>
      !CRITICAL_PATHS.some((c) => h.path.includes(c)) &&
      !MEDIUM_PATHS.includes(h.path),
  );

  // HTTP 200 on a CRITICAL_PATH means the file is truly served — keep CRITICAL per-path.
  // HTTP 403/401/redirects/500 mean the path is confirmed but access is blocked —
  // downgrade to HIGH and group by path family to avoid report flooding.
  // Grouping by family (not per-path) for blocked paths reduces noise (e.g. three
  // .env variants at different endpoints become one HIGH "3 environment config paths"
  // finding) while per-path findings for exposed files (200 status) provide
  // granular remediation guidance for each leaked file.
  const criticalExposed = critical.filter((h) => h.status === 200);
  const criticalBlocked = critical.filter((h) => h.status !== 200);

  for (const hit of criticalExposed) {
    findings.push({
      moduleId: 'P1-06',
      severity: 'CRITICAL',
      category: 'Sensitive Path Exposure',
      // "exposed" is more precise than "publicly accessible" (removed the misleading phrase)
      title: `Sensitive file exposed: ${hit.path}`,
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

  // Categorises a path into a human-readable family name for grouped findings.
  // Used to collapse multiple blocked/redirected hits from the same category
  // (e.g. three .env variants) into a single HIGH finding instead of three.
  function getPathFamily(path: string): string {
    if (path.includes('.env')) return 'Environment config';
    if (path.includes('.git/')) return 'Git repository';
    if (path.includes('.svn/') || path.includes('.hg/') || path.includes('/CVS/')) return 'Version control';
    if (/\.(bak|old|swp)$/.test(path)) return 'Backup file';
    return 'Sensitive file';
  }

  // Group blocked/redirected/error CRITICAL hits by (family, status) so each
  // unique family+status combination produces one HIGH finding.
  // We key on family+status so that 403s and 500s on the same family don't merge
  // (the explanation text references the specific status code).
  const blockedGroups = new Map<string, { family: string; status: number; paths: string[] }>();
  for (const hit of criticalBlocked) {
    const family = getPathFamily(hit.path);
    const key = `${family}::${hit.status}`;
    if (!blockedGroups.has(key)) {
      blockedGroups.set(key, { family, status: hit.status, paths: [] });
    }
    blockedGroups.get(key)!.paths.push(hit.path);
  }

  for (const { family, status, paths } of blockedGroups.values()) {
    const count = paths.length;
    const pathList = paths.join(', ');
    // HTTP 403/401 on CRITICAL_PATHS is HIGH (not MEDIUM) because the path's
    // existence is confirmed; 403 indicates the server recognizes the path but
    // denies access. This is reconnaissance value to an attacker even without
    // data exposure. Contrast with 404 (unknown path) where no finding fires.
    findings.push({
      moduleId: 'P1-06',
      severity: 'HIGH',
      category: 'Sensitive Path Exposure',
      title: `${count} ${family} path${count > 1 ? 's' : ''} confirmed (server returns ${status} — use 404 instead)`,
      location: pathList,
      // One evidence line per path for easy log-level verification
      evidence: paths.map((p) => `GET ${p} → HTTP ${status}`).join('\n'),
      explanation: `These paths exist on the server but access is currently blocked (HTTP ${status}). The file contents are not readable. However, returning ${status} instead of 404 confirms these paths exist, which is useful reconnaissance for an attacker. Return 404 for all of these paths.`,
      impact: 'Path existence confirmed — an attacker knows exactly which sensitive files to target if the server\'s access control changes or is misconfigured.',
      fixManual: [
        `Return 404 (not ${status}) for these paths: ${pathList}`,
        'Configure your hosting platform to deny-list these paths with 404',
        'For Vercel: add to vercel.json headers or use middleware to return 404',
        `After fixing, verify with: curl -I ${crawl.finalUrl}${paths[0]} (should return 404)`,
      ],
      fixAiPrompt: `Block these sensitive paths on my site and return 404 instead of ${status}: ${pathList}. Show me how to configure this for Vercel / nginx / Next.js middleware.`,
    });
  }

  if (medium.length > 0) {
    const list = medium.map((h) => `${h.path} (HTTP ${h.status})`).join(', ');
    findings.push({
      moduleId: 'P1-06',
      severity: 'MEDIUM',
      category: 'Sensitive Path Exposure',
      title: `${medium.length} dependency-lock file${medium.length > 1 ? 's' : ''} publicly accessible`,
      location: medium.map((h) => h.path).join(', '),
      evidence: list,
      explanation: 'Dependency-lock files (yarn.lock, package-lock.json, Gemfile.lock) do not contain secrets, but they make the exact version of every dependency public. Combined with our client-side dependency CVE matching (P1-16), this gives an attacker a precise list of known-vulnerable libraries to target.',
      impact: 'Version pinning becomes public, narrowing the attacker’s search space for known CVEs in your stack. No direct credential exposure.',
      fixManual: [
        'Block lockfiles at the edge in vercel.json, next.config.js headers(), or your nginx/CDN config.',
        'Verify by re-fetching the path: it should return 404, not 200.',
        'Lockfiles still belong in your repo; only the deployed site should not serve them.',
      ],
      fixAiPrompt: `Block public access to the dependency lockfiles ${medium.map((h) => h.path).join(', ')} on my site. Show me how to deny these paths at the hosting layer (Vercel, Next.js, or nginx).`,
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

import type { CrawlResult, RawFinding } from '../types';
import { cleanHtml } from '../tools/html-clean';

const ERROR_PATHS = [
  '/this-path-does-not-exist-vibesafe',
  '/api/vibesafe-nonexistent',
  '/undefined',
  '/%00',
];

interface DisclosurePattern {
  name: string;
  re: RegExp;
  severity: RawFinding['severity'];
}

const DISCLOSURE_PATTERNS: DisclosurePattern[] = [
  { name: 'Node.js / Express stack trace', re: /at\s+\w+\s+\([^)]*\.js:\d+:\d+\)/i, severity: 'HIGH' },
  { name: 'Python / Django stack trace', re: /Traceback \(most recent call last\)|File ".*\.py", line \d+/i, severity: 'HIGH' },
  { name: 'PHP error', re: /(?:Fatal error|Parse error|Warning):\s+.*in\s+\/[^\s]+\.php/i, severity: 'HIGH' },
  { name: 'Ruby / Rails exception', re: /ActionController::|ActiveRecord::|\bNoMethodError\b.*\.rb:\d+/i, severity: 'HIGH' },
  { name: 'Java stack trace', re: /at\s+[\w.]+\([\w.]+\.java:\d+\)/i, severity: 'HIGH' },
  { name: 'Database connection string', re: /(?:postgres|mysql|mongodb):\/\/[^:\s]+:[^@\s]+@/i, severity: 'CRITICAL' },
  { name: 'SQL error', re: /(?:SQLSyntaxErrorException|PG::SyntaxError|ORA-\d{5}|SQLSTATE\[)/i, severity: 'HIGH' },
  { name: 'Framework version disclosure', re: /(?:Express|Django|Laravel|Rails|Spring|ASP\.NET)\s+[\d.]+/i, severity: 'MEDIUM' },
  { name: 'Internal file path', re: /(?:\/home\/|\/var\/www\/|\/usr\/local\/|C:\\(?:inetpub|Users)\\)/i, severity: 'MEDIUM' },
  { name: 'Prisma error details', re: /PrismaClientKnownRequestError|prisma\.\w+\.\w+\(/i, severity: 'MEDIUM' },
];

export async function runErrorDisclosureModule(crawl: CrawlResult): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];
  const base = new URL(crawl.finalUrl).origin;

  const responses = await Promise.all(
    ERROR_PATHS.map(async (path) => {
      try {
        const res = await fetch(`${base}${path}`, {
          signal: AbortSignal.timeout(8_000),
          headers: { 'User-Agent': 'VibeSafe-Scanner/1.0' },
        });
        const body = await res.text();
        return { path, status: res.status, body };
      } catch {
        return null;
      }
    }),
  );

  const seen = new Set<string>();

  for (const resp of responses) {
    if (!resp || resp.body.length < 20) continue;

    // Phase 3.4: many sites route 404s to a marketing or docs page whose
    // <pre>/<code> blocks legitimately contain example stack traces or
    // framework banners. Match the cleaned body so documented examples
    // don't masquerade as real error disclosure.
    const body = cleanHtml(resp.body);

    for (const pattern of DISCLOSURE_PATTERNS) {
      if (seen.has(pattern.name)) continue;
      const match = pattern.re.exec(body);
      if (!match) continue;

      seen.add(pattern.name);
      // Snippet sourced from the cleaned body so the match.index it
      // came from stays valid; this also keeps docs-example text out
      // of evidence on the off chance a future pattern straddles the
      // cleaned region.
      const snippet = body.slice(
        Math.max(0, match.index - 60),
        match.index + match[0].length + 120,
      ).replace(/\s+/g, ' ').trim().slice(0, 300);

      findings.push({
        moduleId: 'P1-12',
        severity: pattern.severity,
        category: 'Error & Stack Trace Disclosure',
        title: `${pattern.name} exposed in error response`,
        location: `${resp.path} (HTTP ${resp.status})`,
        evidence: snippet,
        explanation: `When a request causes an error, your server responds with internal details: ${pattern.name.toLowerCase()}. This gives attackers insight into your technology stack, file structure, or database configuration.`,
        impact: 'Attackers use disclosed framework versions to look up known CVEs, and file paths to identify server configuration. Database connection strings are immediately actionable for exploitation.',
        fixManual: [
          'Set NODE_ENV=production to suppress stack traces in Express/Next.js.',
          'Add a global error handler that returns generic error messages to clients.',
          'Log detailed errors server-side only — never include them in HTTP responses.',
          'In Next.js, errors in API routes should return { error: "Something went wrong" } with no internal details.',
        ],
        fixAiPrompt: `My server exposes ${pattern.name.toLowerCase()} in error responses. Add a global error handler in my Next.js API routes that logs errors server-side and returns only a generic error message to clients.`,
      });
    }
  }

  return findings;
}

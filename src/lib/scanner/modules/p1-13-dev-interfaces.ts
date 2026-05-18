import type { CrawlResult, RawFinding } from '../types';
import { cleanHtml } from '../tools/html-clean';

interface EndpointProbe {
  path: string;
  name: string;
  severity: RawFinding['severity'];
  // Detects a meaningful (non-generic) response
  detect: (status: number, body: string, headers: Record<string, string>) => boolean;
}

const PROBES: EndpointProbe[] = [
  {
    path: '/graphql',
    name: 'GraphQL endpoint',
    severity: 'MEDIUM',
    detect: (status, body, headers) =>
      status === 200 && (
        body.includes('"__typename"') ||
        body.includes('"errors"') ||
        (headers['content-type'] ?? '').includes('application/json')
      ),
  },
  {
    path: '/graphql',
    name: 'GraphQL introspection enabled',
    severity: 'HIGH',
    detect: (_, body) => body.includes('"__schema"') || body.includes('introspectionQuery'),
  },
  {
    path: '/__debug__',
    name: 'Debug interface',
    severity: 'HIGH',
    detect: (status) => status === 200,
  },
  {
    path: '/_profiler',
    name: 'Symfony profiler',
    severity: 'HIGH',
    detect: (status, body) => status === 200 && (body.includes('Symfony') || body.includes('profiler')),
  },
  {
    path: '/actuator',
    name: 'Spring Boot Actuator',
    severity: 'HIGH',
    detect: (status, body) => status === 200 && (body.includes('"_links"') || body.includes('actuator')),
  },
  {
    path: '/actuator/env',
    name: 'Spring Boot Actuator /env (environment variables exposed)',
    severity: 'CRITICAL',
    detect: (status, body) => status === 200 && body.includes('"activeProfiles"'),
  },
  {
    path: '/actuator/health',
    name: 'Spring Boot Actuator /health',
    severity: 'LOW',
    detect: (status, body) => status === 200 && body.includes('"status"'),
  },
  {
    path: '/swagger-ui.html',
    name: 'Swagger UI (API documentation exposed)',
    severity: 'MEDIUM',
    detect: (status, body) => status === 200 && body.includes('swagger'),
  },
  {
    path: '/swagger',
    name: 'Swagger UI',
    severity: 'MEDIUM',
    detect: (status, body) => status === 200 && body.toLowerCase().includes('swagger'),
  },
  {
    path: '/api-docs',
    name: 'API documentation',
    severity: 'MEDIUM',
    detect: (status, body) => status === 200 && (body.includes('"openapi"') || body.includes('"swagger"')),
  },
  {
    path: '/openapi.json',
    name: 'OpenAPI schema exposed',
    severity: 'MEDIUM',
    detect: (status, body) => status === 200 && body.includes('"openapi"'),
  },
  {
    path: '/phpinfo.php',
    name: 'PHPInfo page',
    severity: 'HIGH',
    detect: (status, body) => status === 200 && body.includes('PHP Version'),
  },
  {
    path: '/.well-known/security.txt',
    name: 'security.txt present',
    severity: 'INFO',
    detect: (status) => status === 200,
  },
];

// Paths that are intentionally public and must never generate a finding.
// /.well-known/security.txt returning HTTP 200 is correct behaviour per RFC 9116
// (the standard for publishing a security disclosure policy). Flagging it as an
// "exposed development interface" is a false positive — it is a recommended
// security practice, not a development leak.
const ALLOWED_PATHS = new Set(['/.well-known/security.txt']);

export async function runDevInterfacesModule(crawl: CrawlResult): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];
  const base = new URL(crawl.finalUrl).origin;

  // GraphQL needs a POST with introspection query
  const graphqlIntrospection = async (): Promise<boolean> => {
    try {
      const res = await fetch(`${base}/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ __schema { types { name } } }' }),
        signal: AbortSignal.timeout(8_000),
      });
      const body = await res.text();
      return body.includes('"__schema"');
    } catch { return false; }
  };

  const probeResults = await Promise.all(
    PROBES.map(async (probe) => {
      try {
        const res = await fetch(`${base}${probe.path}`, {
          signal: AbortSignal.timeout(8_000),
          headers: { 'User-Agent': 'VibeSafe-Scanner/1.0' },
        });
        const rawBody = await res.text();
        const headers: Record<string, string> = {};
        res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
        // Phase 3.4: substring/regex detection (e.g. `body.includes('swagger')`,
        // PHP Version, openapi banner) fires on docs/marketing pages that
        // happen to mention the keyword inside an example <pre>/<code>
        // block or HTML comment. JSON-y responses (Swagger schema, Spring
        // _links payload) are not <pre>/comments, so cleaning is a no-op
        // for true positives.
        const body = cleanHtml(rawBody);
        if (probe.detect(res.status, body, headers)) {
          return { probe, status: res.status };
        }
      } catch { /* unreachable */ }
      return null;
    }),
  );

  const introspectionEnabled = await graphqlIntrospection();

  const seen = new Set<string>();
  for (const result of probeResults) {
    if (!result) continue;
    const { probe, status } = result;
    if (seen.has(probe.path + probe.name)) continue;
    seen.add(probe.path + probe.name);

    // Skip paths that are intentionally public (e.g. security.txt per RFC 9116).
    if (ALLOWED_PATHS.has(probe.path)) continue;

    // Skip generic graphql finding if introspection finding also fires
    if (probe.path === '/graphql' && probe.name === 'GraphQL endpoint' && introspectionEnabled) continue;

    findings.push({
      moduleId: 'P1-13',
      severity: probe.severity,
      category: 'Exposed Development Interface',
      title: `${probe.name} accessible without authentication`,
      location: probe.path,
      evidence: `GET ${probe.path} → HTTP ${status}`,
      explanation: `${probe.name} is accessible to unauthenticated users. Development and debugging interfaces expose internal system details and should be restricted or removed in production.`,
      impact: probe.name.includes('env')
        ? 'All environment variables including secrets are exposed to anyone who requests this endpoint.'
        : 'Attackers can map your API surface, discover internal endpoints, and use debug features to gather information for further attacks.',
      fixManual: [
        `Remove or disable ${probe.name} in production.`,
        `If required, restrict access to internal network or authenticated admin users only.`,
        `Add authentication middleware to ${probe.path}.`,
      ],
      fixAiPrompt: `${probe.name} at ${probe.path} is publicly accessible on my site. Add authentication to this endpoint or disable it in production using Next.js middleware or environment-conditional mounting.`,
    });
  }

  if (introspectionEnabled) {
    findings.push({
      moduleId: 'P1-13',
      severity: 'HIGH',
      category: 'Exposed Development Interface',
      title: 'GraphQL introspection enabled in production',
      location: '/graphql',
      evidence: 'POST /graphql with introspection query → __schema returned',
      explanation: 'GraphQL introspection allows anyone to query the full API schema — every type, field, query, and mutation. This maps your entire API surface for attackers.',
      impact: 'Attackers can discover all available queries and mutations, including any that should be private or admin-only.',
      fixManual: [
        'Disable introspection in production: in Apollo Server, set introspection: false.',
        'For other GraphQL servers, consult the docs for disabling the __schema introspection query.',
      ],
      fixAiPrompt: 'My GraphQL API has introspection enabled in production. Disable introspection in my GraphQL server configuration so that the schema cannot be queried by anonymous users.',
    });
  }

  return findings;
}

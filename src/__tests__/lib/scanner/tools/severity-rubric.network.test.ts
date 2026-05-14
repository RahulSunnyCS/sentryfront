import { describe, it, expect, afterEach } from 'vitest';
import { resolveSeverity } from '@/lib/scanner/tools/severity-rubric';
import { installFetchMock } from '@/__tests__/lib/scanner/fixtures/runner';

let restore: (() => void) | null = null;

afterEach(() => {
  if (restore) {
    restore();
    restore = null;
  }
});

describe('resolveSeverity — KEV + EPSS orchestration', () => {
  it('KEV feed 503 → kevMatch false, severity falls back to CVSS-only bucket', async () => {
    restore = installFetchMock({
      responses: [
        {
          urlMatches: 'cisa\\.gov.*known_exploited_vulnerabilities\\.json',
          status: 503,
          body: '',
        },
        {
          urlMatches: 'api\\.first\\.org/data/v1/epss',
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: '{"status":"OK","data":[{"cve":"CVE-2024-0001","epss":"0.10","percentile":"0.60"}]}',
        },
      ],
    });

    const result = await resolveSeverity({
      cveIds: ['CVE-2024-0001'],
      cvssScores: [7.5],
    });
    expect(result.kevMatch).toBe(false);
    expect(result.severity).toBe('HIGH');
    expect(result.epssPercentile).toBe(60);
  });

  it('EPSS 404 → epssPercentile null, conservative fallback preserves HIGH', async () => {
    restore = installFetchMock({
      responses: [
        {
          urlMatches: 'cisa\\.gov.*known_exploited_vulnerabilities\\.json',
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: '{"vulnerabilities":[]}',
        },
        {
          urlMatches: 'api\\.first\\.org/data/v1/epss',
          status: 404,
          body: '',
        },
      ],
    });

    const result = await resolveSeverity({
      cveIds: ['CVE-2024-0002'],
      cvssScores: [7.5],
    });
    expect(result.kevMatch).toBe(false);
    expect(result.epssPercentile).toBeNull();
    expect(result.severity).toBe('HIGH');
  });

  it('multi-CVE with one in KEV → kevMatch true, severity CRITICAL', async () => {
    restore = installFetchMock({
      responses: [
        {
          urlMatches: 'cisa\\.gov.*known_exploited_vulnerabilities\\.json',
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: '{"vulnerabilities":[{"cveID":"CVE-2024-0004"}]}',
        },
        {
          urlMatches: 'api\\.first\\.org/data/v1/epss\\?cve=CVE-2024-0003',
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: '{"status":"OK","data":[{"cve":"CVE-2024-0003","epss":"0.05","percentile":"0.20"}]}',
        },
        {
          urlMatches: 'api\\.first\\.org/data/v1/epss\\?cve=CVE-2024-0004',
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: '{"status":"OK","data":[{"cve":"CVE-2024-0004","epss":"0.85","percentile":"0.95"}]}',
        },
      ],
    });

    const result = await resolveSeverity({
      cveIds: ['CVE-2024-0003', 'CVE-2024-0004'],
      cvssScores: [3.0, 5.0],
    });
    expect(result.kevMatch).toBe(true);
    expect(result.severity).toBe('CRITICAL');
  });

  it('multi-CVE EPSS percentiles → returns max', async () => {
    restore = installFetchMock({
      responses: [
        {
          urlMatches: 'cisa\\.gov.*known_exploited_vulnerabilities\\.json',
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: '{"vulnerabilities":[]}',
        },
        {
          urlMatches: 'api\\.first\\.org/data/v1/epss\\?cve=CVE-2024-0005',
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: '{"status":"OK","data":[{"cve":"CVE-2024-0005","epss":"0.10","percentile":"0.30"}]}',
        },
        {
          urlMatches: 'api\\.first\\.org/data/v1/epss\\?cve=CVE-2024-0006',
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: '{"status":"OK","data":[{"cve":"CVE-2024-0006","epss":"0.40","percentile":"0.75"}]}',
        },
      ],
    });

    const result = await resolveSeverity({
      cveIds: ['CVE-2024-0005', 'CVE-2024-0006'],
      cvssScores: [7.2],
    });
    expect(result.epssPercentile).toBe(75);
    expect(result.severity).toBe('HIGH');
  });

  it('no CVE-style IDs → skips network entirely, returns CVSS-only severity', async () => {
    restore = installFetchMock({
      // Mock everything to 503 so any sneaky network call surfaces as a test failure.
      default: { status: 503, body: '' },
    });

    const result = await resolveSeverity({
      cveIds: ['GHSA-xxxx-yyyy-zzzz'],
      cvssScores: [7.5],
    });
    expect(result.kevMatch).toBe(false);
    expect(result.epssPercentile).toBeNull();
    expect(result.severity).toBe('HIGH');
  });

  it('both feeds down → graceful, severity equals CVSS-only bucket', async () => {
    restore = installFetchMock({
      responses: [
        {
          urlMatches: 'cisa\\.gov.*known_exploited_vulnerabilities\\.json',
          status: 503,
          body: '',
        },
        {
          urlMatches: 'api\\.first\\.org/data/v1/epss',
          status: 503,
          body: '',
        },
      ],
    });

    const result = await resolveSeverity({
      cveIds: ['CVE-2024-0007'],
      cvssScores: [9.5],
    });
    expect(result.kevMatch).toBe(false);
    expect(result.epssPercentile).toBeNull();
    expect(result.severity).toBe('CRITICAL');
  });
});

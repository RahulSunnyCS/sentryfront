import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CrawlResult } from '@/lib/scanner/types';

// Use vi.hoisted so the mock fn is available when vi.mock factory runs.
const { mockResolveTxt } = vi.hoisted(() => ({
  mockResolveTxt: vi.fn(),
}));

// Mock the dns module. The module under test uses:
//   import { promises as dns } from 'dns';
//   dns.resolveTxt(...)
// Factory form (no importOriginal) keeps the mock namespace clean and
// avoids the CJS-named-export binding problem.
vi.mock('dns', () => ({
  promises: { resolveTxt: mockResolveTxt },
  default: { promises: { resolveTxt: mockResolveTxt } },
}));

import { runDnsEmailModule } from '@/lib/scanner/modules/p1-10-dns-email';

// ---------------------------------------------------------------------------
// Minimal CrawlResult factory — only finalUrl matters for this module.
// ---------------------------------------------------------------------------
function makeCrawl(url: string): CrawlResult {
  return {
    finalUrl: url,
    statusCode: 200,
    headers: {},
    cookies: [],
    jsBundleUrls: [],
    inlineScriptContent: '',
    html: '',
    tls: null,
    stack: '',
  };
}

// Helper: set up resolveTxt to return given apex TXT records and DMARC records.
// DKIM selector lookups (containing '._domainkey.') always return [] by default
// so they trigger the INFO finding; use setupDkimFound() to override this.
function setupDns(apexTxt: string[][], dmarcTxt: string[][]) {
  mockResolveTxt.mockImplementation((name: string) => {
    if (name.startsWith('_dmarc.')) return Promise.resolve(dmarcTxt);
    // DKIM selector lookups: return empty to simulate no DKIM found
    if (name.includes('._domainkey.')) return Promise.resolve([]);
    return Promise.resolve(apexTxt);
  });
}

// Helper: make one DKIM selector return a valid record (simulates DKIM found).
function setupDkimFound(apexTxt: string[][], dmarcTxt: string[][]) {
  mockResolveTxt.mockImplementation((name: string) => {
    if (name.startsWith('_dmarc.')) return Promise.resolve(dmarcTxt);
    // Return a DKIM record for the first selector queried
    if (name.startsWith('google._domainkey.')) {
      return Promise.resolve([['v=DKIM1; k=rsa; p=MIGf...']]);
    }
    if (name.includes('._domainkey.')) return Promise.resolve([]);
    return Promise.resolve(apexTxt);
  });
}

// Helper: set up resolveTxt to throw (simulating DNS lookup failure).
function setupDnsError() {
  mockResolveTxt.mockRejectedValue(new Error('ENOTFOUND'));
}

beforeEach(() => {
  mockResolveTxt.mockReset();
});

// ---------------------------------------------------------------------------
// Apex domain extraction
// ---------------------------------------------------------------------------
describe('runDnsEmailModule — apex domain extraction', () => {
  it('uses the two-label apex domain when given a subdomain', async () => {
    // The module strips subdomains so DNS queries target the apex.
    setupDns([['v=spf1 -all']], [['v=DMARC1; p=reject']]);
    await runDnsEmailModule(makeCrawl('https://app.sub.example.com/path'));
    // Apex is 'example.com'; resolveTxt should be called with 'example.com'
    const calls = mockResolveTxt.mock.calls.map((c: [string]) => c[0]);
    expect(calls).toContain('example.com');
    expect(calls).toContain('_dmarc.example.com');
  });

  it('uses the hostname directly when it is already a two-label domain', async () => {
    setupDns([['v=spf1 -all']], [['v=DMARC1; p=reject']]);
    await runDnsEmailModule(makeCrawl('https://example.com/'));
    const calls = mockResolveTxt.mock.calls.map((c: [string]) => c[0]);
    expect(calls).toContain('example.com');
  });
});

// ---------------------------------------------------------------------------
// SPF findings
// ---------------------------------------------------------------------------
describe('runDnsEmailModule — SPF', () => {
  it('emits a MEDIUM finding when no SPF record is present', async () => {
    setupDns([], [['v=DMARC1; p=reject']]);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const spfFinding = findings.find((f) => f.title === 'No SPF record found');
    expect(spfFinding).toBeDefined();
    expect(spfFinding!.severity).toBe('MEDIUM');
    expect(spfFinding!.moduleId).toBe('P1-10');
    expect(spfFinding!.category).toBe('DNS & Email Security');
  });

  it('emits no SPF finding when a valid SPF record with -all exists', async () => {
    setupDns([['v=spf1 include:_spf.google.com -all']], [['v=DMARC1; p=reject']]);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    expect(findings.find((f) => f.title.includes('SPF'))).toBeUndefined();
  });

  it('emits a LOW finding when SPF uses soft fail (~all)', async () => {
    setupDns([['v=spf1 include:_spf.google.com ~all']], [['v=DMARC1; p=reject']]);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const spfFinding = findings.find((f) => f.title.includes('soft fail'));
    expect(spfFinding).toBeDefined();
    expect(spfFinding!.severity).toBe('LOW');
  });

  it('includes the actual SPF record in the evidence of the soft-fail finding', async () => {
    const spfRecord = 'v=spf1 include:_spf.google.com ~all';
    setupDns([[spfRecord]], [['v=DMARC1; p=reject']]);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const spfFinding = findings.find((f) => f.title.includes('soft fail'));
    expect(spfFinding!.evidence).toContain(spfRecord);
  });

  it('includes the apex domain in the SPF finding location', async () => {
    setupDns([], [['v=DMARC1; p=reject']]);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const spfFinding = findings.find((f) => f.title === 'No SPF record found');
    expect(spfFinding!.location).toContain('example.com');
  });

  it('soft-fail fixManual suggests changing to -all', async () => {
    setupDns([['v=spf1 include:_spf.google.com ~all']], [['v=DMARC1; p=reject']]);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const spfFinding = findings.find((f) => f.title.includes('soft fail'));
    const manualText = spfFinding!.fixManual.join(' ');
    expect(manualText).toContain('-all');
  });
});

// ---------------------------------------------------------------------------
// DMARC findings
// ---------------------------------------------------------------------------
describe('runDnsEmailModule — DMARC', () => {
  it('emits a MEDIUM finding when no DMARC record is present', async () => {
    setupDns([['v=spf1 -all']], []);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const dmarcFinding = findings.find((f) => f.title === 'No DMARC record found');
    expect(dmarcFinding).toBeDefined();
    expect(dmarcFinding!.severity).toBe('MEDIUM');
  });

  it('emits no DMARC finding when a valid DMARC record with p=reject exists', async () => {
    setupDns([['v=spf1 -all']], [['v=DMARC1; p=reject; rua=mailto:reports@example.com']]);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    expect(findings.find((f) => f.title.includes('DMARC'))).toBeUndefined();
  });

  it('emits a LOW finding when DMARC policy is p=none', async () => {
    setupDns([['v=spf1 -all']], [['v=DMARC1; p=none; rua=mailto:reports@example.com']]);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const dmarcFinding = findings.find((f) => f.title.includes('none'));
    expect(dmarcFinding).toBeDefined();
    expect(dmarcFinding!.severity).toBe('LOW');
  });

  it('includes the actual DMARC record in the evidence of the p=none finding', async () => {
    const dmarcRecord = 'v=DMARC1; p=none; rua=mailto:reports@example.com';
    setupDns([['v=spf1 -all']], [[dmarcRecord]]);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const dmarcFinding = findings.find((f) => f.title.includes('none'));
    expect(dmarcFinding!.evidence).toContain(dmarcRecord);
  });

  it('includes _dmarc.<apex> in the DMARC finding location', async () => {
    setupDns([['v=spf1 -all']], []);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const dmarcFinding = findings.find((f) => f.title === 'No DMARC record found');
    expect(dmarcFinding!.location).toContain('_dmarc.example.com');
  });

  it('p=none fixManual suggests upgrading to p=quarantine', async () => {
    setupDns([['v=spf1 -all']], [['v=DMARC1; p=none']]);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const dmarcFinding = findings.find((f) => f.title.includes('none'));
    const manualText = dmarcFinding!.fixManual.join(' ');
    expect(manualText).toContain('quarantine');
  });
});

// ---------------------------------------------------------------------------
// Combined scenarios
// ---------------------------------------------------------------------------
describe('runDnsEmailModule — combined SPF + DMARC', () => {
  it('returns no findings when both SPF (-all) and DMARC (p=reject) are present and DKIM confirmed', async () => {
    // Use setupDkimFound so DKIM is confirmed → no DKIM INFO finding emitted.
    setupDkimFound(
      [['v=spf1 include:_spf.google.com -all']],
      [['v=DMARC1; p=reject; rua=mailto:dmarc@example.com']],
    );
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    expect(findings).toHaveLength(0);
  });

  it('returns SPF, DMARC, and DKIM findings when all three are missing', async () => {
    // setupDns returns [] for DKIM selectors → DKIM INFO finding emitted
    setupDns([], []);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const titles = findings.map((f) => f.title);
    expect(titles).toContain('No SPF record found');
    expect(titles).toContain('No DMARC record found');
    expect(titles).toContain('DKIM presence could not be confirmed via common selectors');
    expect(findings).toHaveLength(3);
  });

  it('returns both LOW findings (SPF ~all, DMARC p=none) plus DKIM INFO when no DKIM found', async () => {
    setupDns([['v=spf1 ~all']], [['v=DMARC1; p=none']]);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    // 2 LOW findings + 1 INFO finding
    expect(findings).toHaveLength(3);
    const nonDkim = findings.filter(
      (f) => f.title !== 'DKIM presence could not be confirmed via common selectors',
    );
    expect(nonDkim.every((f) => f.severity === 'LOW')).toBe(true);
  });

  it('returns DMARC finding and DKIM INFO when SPF is good but DMARC and DKIM missing', async () => {
    setupDns([['v=spf1 -all']], []);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const titles = findings.map((f) => f.title);
    expect(titles).toContain('No DMARC record found');
    expect(titles).toContain('DKIM presence could not be confirmed via common selectors');
    expect(findings).toHaveLength(2);
  });

  it('returns SPF finding and DKIM INFO when DMARC is good but SPF and DKIM missing', async () => {
    setupDns([], [['v=DMARC1; p=reject']]);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const titles = findings.map((f) => f.title);
    expect(titles).toContain('No SPF record found');
    expect(titles).toContain('DKIM presence could not be confirmed via common selectors');
    expect(findings).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// DNS resolution errors
// ---------------------------------------------------------------------------
describe('runDnsEmailModule — DNS resolution errors', () => {
  it('treats a DNS error for apex TXT records as no SPF and no DMARC', async () => {
    // When DNS lookup fails, getTxtRecords returns [] — same as no record.
    mockResolveTxt.mockRejectedValue(new Error('ENOTFOUND'));
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const titles = findings.map((f) => f.title);
    expect(titles).toContain('No SPF record found');
    expect(titles).toContain('No DMARC record found');
  });

  it('treats a partial DNS error (apex ok, DMARC fails) as no DMARC; DKIM selectors empty → INFO', async () => {
    // apex TXT (SPF) resolves fine; DMARC and DKIM selectors fail/empty
    mockResolveTxt.mockImplementation((name: string) => {
      if (name.startsWith('_dmarc.')) return Promise.reject(new Error('NXDOMAIN'));
      // DKIM selector lookups return empty (no DKIM found)
      if (name.includes('._domainkey.')) return Promise.resolve([]);
      return Promise.resolve([['v=spf1 -all']]);
    });
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const titles = findings.map((f) => f.title);
    expect(titles).toContain('No DMARC record found');
    expect(titles).toContain('DKIM presence could not be confirmed via common selectors');
    expect(findings).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Multi-segment TXT records (arrays joined)
// ---------------------------------------------------------------------------
describe('runDnsEmailModule — multi-segment TXT records', () => {
  it('joins multi-segment TXT record arrays into a single string', async () => {
    // DNS TXT records can be split across multiple strings in the array.
    // The module joins them with '' before checking for v=spf1.
    setupDns([['v=spf1 include:_spf.google.com', ' -all']], [['v=DMARC1; p=reject']]);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    // Joined: 'v=spf1 include:_spf.google.com -all' — valid, no findings
    expect(findings.find((f) => f.title.includes('SPF'))).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// DKIM best-effort probe
// ---------------------------------------------------------------------------
describe('runDnsEmailModule — DKIM', () => {
  it('emits no DKIM finding when at least one selector resolves to a non-empty TXT record', async () => {
    // One selector ('google') returns a DKIM record → DKIM confirmed → no finding.
    setupDkimFound([['v=spf1 -all']], [['v=DMARC1; p=reject']]);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const dkimFinding = findings.find((f) =>
      f.title.includes('DKIM presence could not be confirmed'),
    );
    expect(dkimFinding).toBeUndefined();
  });

  it('emits an INFO finding when all selectors return empty TXT records', async () => {
    // setupDns returns [] for all _domainkey lookups → inconclusive → INFO finding.
    setupDns([['v=spf1 -all']], [['v=DMARC1; p=reject']]);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const dkimFinding = findings.find((f) =>
      f.title === 'DKIM presence could not be confirmed via common selectors',
    );
    expect(dkimFinding).toBeDefined();
    expect(dkimFinding!.severity).toBe('INFO');
    expect(dkimFinding!.moduleId).toBe('P1-10');
    expect(dkimFinding!.category).toBe('DNS & Email Security');
  });

  it('INFO finding explanation contains the word "inconclusive"', async () => {
    setupDns([['v=spf1 -all']], [['v=DMARC1; p=reject']]);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const dkimFinding = findings.find((f) =>
      f.title === 'DKIM presence could not be confirmed via common selectors',
    );
    expect(dkimFinding!.explanation).toContain('inconclusive');
  });

  it('emits an INFO finding when all selectors throw a DNS error (inconclusive, not an error)', async () => {
    // DNS errors on selector lookups → getTxtRecords returns [] → all inconclusive → INFO.
    // Use a targeted mock: SPF and DMARC resolve fine, DKIM selectors all throw.
    mockResolveTxt.mockImplementation((name: string) => {
      if (name.startsWith('_dmarc.')) return Promise.resolve([['v=DMARC1; p=reject']]);
      if (name.includes('._domainkey.')) return Promise.reject(new Error('SERVFAIL'));
      return Promise.resolve([['v=spf1 -all']]);
    });
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const dkimFinding = findings.find((f) =>
      f.title === 'DKIM presence could not be confirmed via common selectors',
    );
    // DNS errors are treated as inconclusive — still emits INFO, never throws.
    expect(dkimFinding).toBeDefined();
    expect(dkimFinding!.severity).toBe('INFO');
  });

  it('emits an INFO finding when some selectors error and the rest return empty (mixed)', async () => {
    // Odd-indexed selectors throw, even-indexed return empty — still inconclusive.
    let callCount = 0;
    mockResolveTxt.mockImplementation((name: string) => {
      if (name.startsWith('_dmarc.')) return Promise.resolve([['v=DMARC1; p=reject']]);
      if (name.includes('._domainkey.')) {
        callCount++;
        return callCount % 2 === 0
          ? Promise.reject(new Error('ENOTFOUND'))
          : Promise.resolve([]);
      }
      return Promise.resolve([['v=spf1 -all']]);
    });
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const dkimFinding = findings.find((f) =>
      f.title === 'DKIM presence could not be confirmed via common selectors',
    );
    expect(dkimFinding).toBeDefined();
    expect(dkimFinding!.severity).toBe('INFO');
  });

  it('probes the apex domain (not subdomain) for DKIM selectors', async () => {
    setupDkimFound([['v=spf1 -all']], [['v=DMARC1; p=reject']]);
    await runDnsEmailModule(makeCrawl('https://app.sub.example.com/'));
    // All DKIM selector lookups should use the apex domain 'example.com'
    const dkimCalls = mockResolveTxt.mock.calls
      .map((c: [string]) => c[0])
      .filter((name: string) => name.includes('._domainkey.'));
    expect(dkimCalls.length).toBeGreaterThan(0);
    dkimCalls.forEach((name: string) => {
      expect(name).toContain('._domainkey.example.com');
    });
  });

  it('queries exactly 9 DKIM selectors in parallel', async () => {
    setupDkimFound([['v=spf1 -all']], [['v=DMARC1; p=reject']]);
    await runDnsEmailModule(makeCrawl('https://example.com'));
    const dkimCalls = mockResolveTxt.mock.calls
      .map((c: [string]) => c[0])
      .filter((name: string) => name.includes('._domainkey.'));
    expect(dkimCalls).toHaveLength(9);
  });
});

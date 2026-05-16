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
function setupDns(apexTxt: string[][], dmarcTxt: string[][]) {
  mockResolveTxt.mockImplementation((name: string) => {
    if (name.startsWith('_dmarc.')) return Promise.resolve(dmarcTxt);
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
  it('returns no findings when both SPF (-all) and DMARC (p=reject) are present', async () => {
    setupDns(
      [['v=spf1 include:_spf.google.com -all']],
      [['v=DMARC1; p=reject; rua=mailto:dmarc@example.com']],
    );
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    expect(findings).toHaveLength(0);
  });

  it('returns both SPF and DMARC findings when both are missing', async () => {
    setupDns([], []);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    const titles = findings.map((f) => f.title);
    expect(titles).toContain('No SPF record found');
    expect(titles).toContain('No DMARC record found');
    expect(findings).toHaveLength(2);
  });

  it('returns both LOW findings when SPF uses ~all and DMARC uses p=none', async () => {
    setupDns([['v=spf1 ~all']], [['v=DMARC1; p=none']]);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    expect(findings).toHaveLength(2);
    expect(findings.every((f) => f.severity === 'LOW')).toBe(true);
  });

  it('returns only a DMARC finding when SPF is good but DMARC is missing', async () => {
    setupDns([['v=spf1 -all']], []);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('No DMARC record found');
  });

  it('returns only an SPF finding when DMARC is good but SPF is missing', async () => {
    setupDns([], [['v=DMARC1; p=reject']]);
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('No SPF record found');
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

  it('treats a partial DNS error (apex ok, DMARC fails) as no DMARC', async () => {
    mockResolveTxt.mockImplementation((name: string) => {
      if (name.startsWith('_dmarc.')) return Promise.reject(new Error('NXDOMAIN'));
      return Promise.resolve([['v=spf1 -all']]);
    });
    const findings = await runDnsEmailModule(makeCrawl('https://example.com'));
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('No DMARC record found');
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

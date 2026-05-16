import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindBinary, mockRunTool, mockExistsSync } = vi.hoisted(() => ({
  mockFindBinary: vi.fn(),
  mockRunTool: vi.fn(),
  mockExistsSync: vi.fn(),
}));

vi.mock('@/lib/scanner/tools/runner', () => ({
  findBinary: mockFindBinary,
  runTool: mockRunTool,
}));

// Use factory form so named imports inside nuclei.ts bind to our mocks.
vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  default: { existsSync: mockExistsSync },
}));

vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
  default: { homedir: vi.fn(() => '/home/testuser') },
}));

vi.mock('path', async (importOriginal) => importOriginal());

import { runNuclei } from '@/lib/scanner/tools/nuclei';

// A valid JSONL line that nuclei would output
const validNucleiLine = JSON.stringify({
  template: 'exposures/configs/ds-store.yaml',
  'template-id': 'ds-store',
  info: {
    name: '.DS_Store File Disclosure',
    severity: 'medium',
    description: 'DS Store file found, may expose directory structure.',
    tags: ['exposure', 'config'],
  },
  host: 'https://example.com',
  matched: 'https://example.com/.DS_Store',
  'extracted-results': ['some-file-path'],
});

beforeEach(() => {
  mockFindBinary.mockReset();
  mockRunTool.mockReset();
  mockExistsSync.mockReset();
});

// ---------------------------------------------------------------------------
// Binary not installed
// ---------------------------------------------------------------------------
describe('runNuclei — binary not installed', () => {
  it('returns [] immediately', async () => {
    mockFindBinary.mockReturnValue(null);
    const result = await runNuclei('https://example.com');
    expect(result).toEqual([]);
    expect(mockRunTool).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Templates directory not found
// ---------------------------------------------------------------------------
describe('runNuclei — templates not downloaded', () => {
  it('returns [] when no templates directory exists', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/nuclei');
    // All candidate template dirs return false
    mockExistsSync.mockReturnValue(false);
    const result = await runNuclei('https://example.com');
    expect(result).toEqual([]);
    expect(mockRunTool).not.toHaveBeenCalled();
  });

  it('finds the ~/nuclei-templates directory', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/nuclei');
    // Only the primary candidate exists
    mockExistsSync.mockImplementation(
      (p: string) => p === '/home/testuser/nuclei-templates',
    );
    mockRunTool.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    await runNuclei('https://example.com');
    expect(mockRunTool).toHaveBeenCalled();
  });

  it('finds the ~/.nuclei-templates directory', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/nuclei');
    mockExistsSync.mockImplementation(
      (p: string) => p === '/home/testuser/.nuclei-templates',
    );
    mockRunTool.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    await runNuclei('https://example.com');
    expect(mockRunTool).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// No findings (empty output)
// ---------------------------------------------------------------------------
describe('runNuclei — binary and templates present, no findings', () => {
  beforeEach(() => {
    mockFindBinary.mockReturnValue('/usr/local/bin/nuclei');
    mockExistsSync.mockImplementation(
      (p: string) => p === '/home/testuser/nuclei-templates',
    );
  });

  it('returns [] when stdout is empty', async () => {
    mockRunTool.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    const result = await runNuclei('https://example.com');
    expect(result).toEqual([]);
  });

  it('returns [] when stdout is whitespace only', async () => {
    mockRunTool.mockResolvedValue({ stdout: '   \n   ', stderr: '', exitCode: 0 });
    const result = await runNuclei('https://example.com');
    expect(result).toEqual([]);
  });

  it('skips lines that are not valid JSON', async () => {
    mockRunTool.mockResolvedValue({
      stdout: 'not-json-line\nanother-bad-line',
      stderr: '',
      exitCode: 0,
    });
    const result = await runNuclei('https://example.com');
    expect(result).toEqual([]);
  });

  it('skips blank lines in the output', async () => {
    mockRunTool.mockResolvedValue({
      stdout: '\n\n' + validNucleiLine + '\n\n',
      stderr: '',
      exitCode: 0,
    });
    const result = await runNuclei('https://example.com');
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Finding parsing
// ---------------------------------------------------------------------------
describe('runNuclei — finding parsing', () => {
  beforeEach(() => {
    mockFindBinary.mockReturnValue('/usr/local/bin/nuclei');
    mockExistsSync.mockImplementation(
      (p: string) => p === '/home/testuser/nuclei-templates',
    );
    mockRunTool.mockResolvedValue({ stdout: validNucleiLine, stderr: '', exitCode: 0 });
  });

  it('returns one finding for one JSONL line', async () => {
    const findings = await runNuclei('https://example.com');
    expect(findings).toHaveLength(1);
  });

  it('sets moduleId to P1-06', async () => {
    const findings = await runNuclei('https://example.com');
    expect(findings[0].moduleId).toBe('P1-06');
  });

  it('sets the finding title from info.name', async () => {
    const findings = await runNuclei('https://example.com');
    expect(findings[0].title).toBe('.DS_Store File Disclosure');
  });

  it('extracts the pathname from the matched URL', async () => {
    const findings = await runNuclei('https://example.com');
    expect(findings[0].location).toBe('/.DS_Store');
  });

  it('includes the template-id in the evidence', async () => {
    const findings = await runNuclei('https://example.com');
    expect(findings[0].evidence).toContain('ds-store');
  });

  it('includes the matched URL in the evidence', async () => {
    const findings = await runNuclei('https://example.com');
    expect(findings[0].evidence).toContain('https://example.com/.DS_Store');
  });

  it('includes up to 2 extracted-results in the evidence', async () => {
    const lineWithExtracted = JSON.stringify({
      ...JSON.parse(validNucleiLine),
      'extracted-results': ['result-1', 'result-2', 'result-3'],
    });
    mockRunTool.mockResolvedValue({ stdout: lineWithExtracted, stderr: '', exitCode: 0 });
    const findings = await runNuclei('https://example.com');
    expect(findings[0].evidence).toContain('result-1');
    expect(findings[0].evidence).toContain('result-2');
    // Third extracted result should be omitted (slice(0, 2))
    expect(findings[0].evidence).not.toContain('result-3');
  });

  it('uses info.description as explanation when present', async () => {
    const findings = await runNuclei('https://example.com');
    expect(findings[0].explanation).toContain('DS Store file found');
  });

  it('falls back to a generated explanation when description is absent', async () => {
    const lineNoDesc = JSON.stringify({
      ...JSON.parse(validNucleiLine),
      info: { name: 'Panel Exposed', severity: 'high' },
    });
    mockRunTool.mockResolvedValue({ stdout: lineNoDesc, stderr: '', exitCode: 0 });
    const findings = await runNuclei('https://example.com');
    // Fallback explanation: "Nuclei detected a misconfiguration or exposure at <path> ..."
    expect(findings[0].explanation).toContain('Nuclei detected');
  });

  it('uses host as location fallback when matched field is absent', async () => {
    const lineNoMatched = JSON.stringify({
      ...JSON.parse(validNucleiLine),
      matched: undefined,
    });
    mockRunTool.mockResolvedValue({ stdout: lineNoMatched, stderr: '', exitCode: 0 });
    const findings = await runNuclei('https://example.com');
    // host is 'https://example.com', pathname is '/'
    expect(findings[0].location).toBe('/');
  });

  it('uses matched as-is for location when it is not a valid URL', async () => {
    const lineRawMatch = JSON.stringify({
      ...JSON.parse(validNucleiLine),
      matched: '/some/path',
    });
    mockRunTool.mockResolvedValue({ stdout: lineRawMatch, stderr: '', exitCode: 0 });
    const findings = await runNuclei('https://example.com');
    expect(findings[0].location).toBe('/some/path');
  });

  it('includes a link to the nuclei-templates repo in fixManual', async () => {
    const findings = await runNuclei('https://example.com');
    expect(findings[0].fixManual.some((s) => s.includes('github.com/projectdiscovery'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Severity mapping
// ---------------------------------------------------------------------------
describe('runNuclei — severity mapping', () => {
  beforeEach(() => {
    mockFindBinary.mockReturnValue('/usr/local/bin/nuclei');
    mockExistsSync.mockImplementation(
      (p: string) => p === '/home/testuser/nuclei-templates',
    );
  });

  const severityCases = [
    { nucleiSev: 'critical', expected: 'CRITICAL' },
    { nucleiSev: 'high', expected: 'HIGH' },
    { nucleiSev: 'medium', expected: 'MEDIUM' },
    { nucleiSev: 'low', expected: 'LOW' },
    { nucleiSev: 'info', expected: 'INFO' },
    { nucleiSev: 'unknown', expected: 'INFO' },
    { nucleiSev: 'CRITICAL', expected: 'CRITICAL' },  // case-insensitive
    { nucleiSev: 'HIGH', expected: 'HIGH' },
    { nucleiSev: 'garbage-value', expected: 'INFO' }, // unmapped → INFO
  ];

  for (const { nucleiSev, expected } of severityCases) {
    it(`maps nuclei severity "${nucleiSev}" → ${expected}`, async () => {
      const line = JSON.stringify({
        ...JSON.parse(validNucleiLine),
        info: { name: 'Test Finding', severity: nucleiSev },
      });
      mockRunTool.mockResolvedValue({ stdout: line, stderr: '', exitCode: 0 });
      const findings = await runNuclei('https://example.com');
      expect(findings[0].severity).toBe(expected);
    });
  }
});

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
describe('runNuclei — CLI flags', () => {
  it('passes the target URL and expected flags', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/nuclei');
    mockExistsSync.mockImplementation(
      (p: string) => p === '/home/testuser/nuclei-templates',
    );
    mockRunTool.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    await runNuclei('https://target.example.com');
    const [, args, opts] = mockRunTool.mock.calls[0] as [string, string[], { timeoutMs: number }];
    expect(args).toContain('-u');
    expect(args).toContain('https://target.example.com');
    expect(args).toContain('-j');       // JSONL output
    expect(args).toContain('-silent');
    expect(args).toContain('-no-color');
    expect(opts.timeoutMs).toBe(60_000);
  });

  it('includes safe passive template tags', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/nuclei');
    mockExistsSync.mockImplementation(
      (p: string) => p === '/home/testuser/nuclei-templates',
    );
    mockRunTool.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    await runNuclei('https://example.com');
    const [, args] = mockRunTool.mock.calls[0] as [string, string[], unknown];
    const tagsIdx = args.indexOf('-tags');
    expect(tagsIdx).toBeGreaterThan(-1);
    expect(args[tagsIdx + 1]).toContain('exposure');
  });
});

// ---------------------------------------------------------------------------
// Multiple findings
// ---------------------------------------------------------------------------
describe('runNuclei — multiple findings', () => {
  it('parses multiple JSONL lines into multiple findings', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/nuclei');
    mockExistsSync.mockImplementation(
      (p: string) => p === '/home/testuser/nuclei-templates',
    );

    const line2 = JSON.stringify({
      template: 'panels/admin-panel.yaml',
      'template-id': 'admin-panel',
      info: { name: 'Admin Panel Detected', severity: 'high' },
      host: 'https://example.com',
      matched: 'https://example.com/admin',
    });

    mockRunTool.mockResolvedValue({
      stdout: `${validNucleiLine}\n${line2}`,
      stderr: '',
      exitCode: 0,
    });

    const findings = await runNuclei('https://example.com');
    expect(findings).toHaveLength(2);
    expect(findings.map((f) => f.title)).toEqual([
      '.DS_Store File Disclosure',
      'Admin Panel Detected',
    ]);
  });
});

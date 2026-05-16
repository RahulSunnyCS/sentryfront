import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted makes these available to the vi.mock factory functions which are
// hoisted above import statements.
const { mockFindBinary, mockRunTool, mockExistsSync, mockReadFileSync } = vi.hoisted(() => ({
  mockFindBinary: vi.fn(),
  mockRunTool: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
}));

vi.mock('@/lib/scanner/tools/runner', () => ({
  findBinary: mockFindBinary,
  runTool: mockRunTool,
}));

// Use factory form (no importOriginal) so the named imports inside gitleaks.ts
// bind to our mocks rather than the real Node built-ins.
vi.mock('fs', () => ({
  mkdtempSync: vi.fn(() => '/tmp/vibesafe-gl-test'),
  writeFileSync: vi.fn(),
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  unlinkSync: vi.fn(),
  rmSync: vi.fn(),
  default: {
    mkdtempSync: vi.fn(() => '/tmp/vibesafe-gl-test'),
    writeFileSync: vi.fn(),
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    unlinkSync: vi.fn(),
    rmSync: vi.fn(),
  },
}));

vi.mock('os', () => ({
  tmpdir: vi.fn(() => '/tmp'),
  default: { tmpdir: vi.fn(() => '/tmp') },
}));

// Use importOriginal for path so path.join etc. work normally.
vi.mock('path', async (importOriginal) => importOriginal());

import { runGitleaks } from '@/lib/scanner/tools/gitleaks';

const SAMPLE_MATCH = {
  RuleID: 'stripe-access-token',
  Description: 'Stripe API Key',
  StartLine: 42,
  Match: 'sk_live_abc1234****',
  Secret: 'sk_live_abc1234567890',
  File: '/tmp/vibesafe-gl-test/source.js',
  Entropy: 4.2,
};

beforeEach(() => {
  mockFindBinary.mockReset();
  mockRunTool.mockReset();
  mockExistsSync.mockReset();
  mockReadFileSync.mockReset();
});

// ---------------------------------------------------------------------------
// Binary not installed
// ---------------------------------------------------------------------------
describe('runGitleaks — binary not installed', () => {
  it('returns [] immediately and does not call runTool', async () => {
    mockFindBinary.mockReturnValue(null);
    const result = await runGitleaks([{ label: 'bundle.js', content: 'const x = 1;' }]);
    expect(result).toEqual([]);
    expect(mockRunTool).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Binary installed but no findings
// ---------------------------------------------------------------------------
describe('runGitleaks — binary installed, no findings', () => {
  beforeEach(() => {
    mockFindBinary.mockReturnValue('/usr/local/bin/gitleaks');
    mockRunTool.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
  });

  it('returns [] when no report file is created', async () => {
    // existsSync returns false → report file does not exist
    mockExistsSync.mockReturnValue(false);
    const result = await runGitleaks([{ label: 'bundle.js', content: 'some content' }]);
    expect(result).toEqual([]);
  });

  it('returns [] when the report file contains null', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('null');
    const result = await runGitleaks([{ label: 'bundle.js', content: 'some content' }]);
    expect(result).toEqual([]);
  });

  it('returns [] when the report file is empty', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('');
    const result = await runGitleaks([{ label: 'bundle.js', content: 'some content' }]);
    expect(result).toEqual([]);
  });

  it('returns [] when the report file contains invalid JSON', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('not valid json {{{');
    const result = await runGitleaks([{ label: 'bundle.js', content: 'some content' }]);
    expect(result).toEqual([]);
  });

  it('skips sources with empty content', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await runGitleaks([
      { label: 'empty.js', content: '   ' },
      { label: 'whitespace.js', content: '\n\n' },
    ]);
    expect(result).toEqual([]);
    // runTool should not be called because all content is whitespace-only
    expect(mockRunTool).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Binary installed, valid findings returned
// ---------------------------------------------------------------------------
describe('runGitleaks — binary installed, findings detected', () => {
  beforeEach(() => {
    mockFindBinary.mockReturnValue('/usr/local/bin/gitleaks');
    mockRunTool.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify([SAMPLE_MATCH]));
  });

  it('returns one RawFinding for a single match', async () => {
    const findings = await runGitleaks([{ label: 'bundle.js', content: 'sk_live_abc1234567890' }]);
    expect(findings).toHaveLength(1);
  });

  it('sets the correct moduleId and category', async () => {
    const findings = await runGitleaks([{ label: 'bundle.js', content: 'sk_live_abc1234567890' }]);
    expect(findings[0].moduleId).toBe('P1-01');
    expect(findings[0].category).toBe('Client-Side Secret Exposure');
  });

  it('uses the source label as the finding location', async () => {
    const findings = await runGitleaks([{ label: 'chunk-a.js', content: 'sk_live_abc1234567890' }]);
    expect(findings[0].location).toBe('chunk-a.js');
  });

  it('redacts the secret in the evidence field', async () => {
    const findings = await runGitleaks([{ label: 'bundle.js', content: 'sk_live_abc1234567890' }]);
    // Secret is 'sk_live_abc1234567890'; redacted = first4 + **** + last4
    expect(findings[0].evidence).toContain('sk_l****7890');
    expect(findings[0].evidence).not.toContain('sk_live_abc1234567890');
  });

  it('includes the rule ID and line number in the evidence', async () => {
    const findings = await runGitleaks([{ label: 'bundle.js', content: 'secret' }]);
    expect(findings[0].evidence).toContain('stripe-access-token');
    expect(findings[0].evidence).toContain('42');
  });

  it('includes fixManual steps', async () => {
    const findings = await runGitleaks([{ label: 'bundle.js', content: 'secret' }]);
    expect(findings[0].fixManual).toHaveLength(4);
  });

  it('passes correct CLI flags to runTool', async () => {
    await runGitleaks([{ label: 'bundle.js', content: 'sk_live_abc1234567890' }]);
    const args = mockRunTool.mock.calls[0][1] as string[];
    expect(args).toContain('detect');
    expect(args).toContain('--no-git');
    expect(args).toContain('json');
    expect(args).toContain('0');
  });
});

// ---------------------------------------------------------------------------
// Severity mapping
// ---------------------------------------------------------------------------
describe('runGitleaks — severity mapping', () => {
  beforeEach(() => {
    mockFindBinary.mockReturnValue('/usr/local/bin/gitleaks');
    mockRunTool.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockExistsSync.mockReturnValue(true);
  });

  const severityCases: Array<{ ruleId: string; expected: string }> = [
    { ruleId: 'stripe-live-key', expected: 'CRITICAL' },
    { ruleId: 'twilio-live-api-key', expected: 'CRITICAL' },
    { ruleId: 'paypal-live-token', expected: 'CRITICAL' },
    { ruleId: 'rsa-private-key', expected: 'CRITICAL' },
    { ruleId: 'pkcs12-cert', expected: 'CRITICAL' },
    { ruleId: 'aws-access-key', expected: 'CRITICAL' },
    { ruleId: 'gcp-api-key', expected: 'CRITICAL' },
    { ruleId: 'azure-api-key', expected: 'CRITICAL' },
    { ruleId: 'github-token', expected: 'CRITICAL' },
    { ruleId: 'gitlab-ci-token', expected: 'CRITICAL' },
    { ruleId: 'npm-access-token', expected: 'CRITICAL' },
    { ruleId: 'openai-api-key', expected: 'CRITICAL' },
    { ruleId: 'anthropic-api-key', expected: 'CRITICAL' },
    { ruleId: 'cohere-api-key', expected: 'CRITICAL' },
    { ruleId: 'replicate-api-token', expected: 'CRITICAL' },
    { ruleId: 'stripe-test-key', expected: 'HIGH' },
    { ruleId: 'sendgrid-api-key', expected: 'HIGH' },
    { ruleId: 'mailgun-private-api-key', expected: 'HIGH' },
    { ruleId: 'twilio-api-key', expected: 'HIGH' },
    { ruleId: 'generic-token', expected: 'HIGH' },
  ];

  for (const { ruleId, expected } of severityCases) {
    it(`maps rule "${ruleId}" to severity ${expected}`, async () => {
      const match = { ...SAMPLE_MATCH, RuleID: ruleId };
      mockReadFileSync.mockReturnValue(JSON.stringify([match]));
      const findings = await runGitleaks([{ label: 'bundle.js', content: 'secret' }]);
      expect(findings[0].severity).toBe(expected);
    });
  }
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------
describe('runGitleaks — deduplication across sources', () => {
  it('deduplicates findings with the same RuleID across multiple sources', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/gitleaks');
    mockRunTool.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockExistsSync.mockReturnValue(true);
    // Both sources return the same rule — only one finding should be produced.
    mockReadFileSync.mockReturnValue(JSON.stringify([SAMPLE_MATCH]));

    const findings = await runGitleaks([
      { label: 'bundle1.js', content: 'sk_live_abc' },
      { label: 'bundle2.js', content: 'sk_live_abc' },
    ]);
    expect(findings).toHaveLength(1);
  });

  it('keeps distinct findings for different RuleIDs', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/gitleaks');
    mockRunTool.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockExistsSync.mockReturnValue(true);

    let callCount = 0;
    mockReadFileSync.mockImplementation(() => {
      callCount++;
      // First source returns stripe match; second returns github match
      const match = callCount === 1
        ? { ...SAMPLE_MATCH, RuleID: 'stripe-live-key' }
        : { ...SAMPLE_MATCH, RuleID: 'github-token' };
      return JSON.stringify([match]);
    });

    const findings = await runGitleaks([
      { label: 'bundle1.js', content: 'stripe_key' },
      { label: 'bundle2.js', content: 'github_token' },
    ]);
    expect(findings).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Secret redaction edge cases
// ---------------------------------------------------------------------------
describe('runGitleaks — secret redaction', () => {
  beforeEach(() => {
    mockFindBinary.mockReturnValue('/usr/local/bin/gitleaks');
    mockRunTool.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockExistsSync.mockReturnValue(true);
  });

  it('redacts short secrets (≤8 chars) as ****', async () => {
    const match = { ...SAMPLE_MATCH, Secret: 'short' };
    mockReadFileSync.mockReturnValue(JSON.stringify([match]));
    const findings = await runGitleaks([{ label: 'b.js', content: 'short' }]);
    expect(findings[0].evidence).toContain('****');
    // Should not reveal the short secret
    expect(findings[0].evidence).not.toContain('short');
  });

  it('redacts long secrets showing first4 and last4', async () => {
    const match = { ...SAMPLE_MATCH, Secret: 'sk_live_longkeyhere' };
    mockReadFileSync.mockReturnValue(JSON.stringify([match]));
    const findings = await runGitleaks([{ label: 'b.js', content: 'sk_live_longkeyhere' }]);
    expect(findings[0].evidence).toContain('sk_l****here');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/scanner/tools/runner', () => ({
  findBinary: vi.fn(),
  runTool: vi.fn(),
}));

import { findBinary, runTool } from '@/lib/scanner/tools/runner';
import { runSubfinder } from '@/lib/scanner/tools/subfinder';

const mockFindBinary = findBinary as ReturnType<typeof vi.fn>;
const mockRunTool = runTool as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFindBinary.mockReset();
  mockRunTool.mockReset();
});

describe('runSubfinder', () => {
  it('returns [] immediately when subfinder binary is not installed', async () => {
    mockFindBinary.mockReturnValue(null);
    const result = await runSubfinder('example.com');
    expect(result).toEqual([]);
    expect(mockRunTool).not.toHaveBeenCalled();
  });

  it('parses valid subdomains from stdout', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/subfinder');
    mockRunTool.mockResolvedValue({
      stdout: 'app.example.com\ndocs.example.com\napi.example.com\n',
      stderr: '',
      exitCode: 0,
    });

    const result = await runSubfinder('example.com');
    expect(result).toEqual(['app.example.com', 'docs.example.com', 'api.example.com']);
  });

  it('filters out entries that do not end with .{apex}', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/subfinder');
    mockRunTool.mockResolvedValue({
      stdout: 'app.example.com\nmalicious.other.com\nexample.com\n',
      stderr: '',
      exitCode: 0,
    });

    const result = await runSubfinder('example.com');
    // 'example.com' itself does not end with '.example.com', 'malicious.other.com' is wrong apex
    expect(result).toEqual(['app.example.com']);
  });

  it('returns [] when stdout is empty', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/subfinder');
    mockRunTool.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    const result = await runSubfinder('example.com');
    expect(result).toEqual([]);
  });

  it('trims whitespace from each line', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/subfinder');
    mockRunTool.mockResolvedValue({
      stdout: '  app.example.com  \n  docs.example.com  \n',
      stderr: '',
      exitCode: 0,
    });

    const result = await runSubfinder('example.com');
    expect(result).toEqual(['app.example.com', 'docs.example.com']);
  });

  it('caps results at 50 subdomains', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/subfinder');
    // Generate 60 valid subdomains
    const lines = Array.from({ length: 60 }, (_, i) => `sub${i}.example.com`).join('\n');
    mockRunTool.mockResolvedValue({ stdout: lines, stderr: '', exitCode: 0 });

    const result = await runSubfinder('example.com');
    expect(result).toHaveLength(50);
  });

  it('passes correct CLI flags to runTool', async () => {
    mockFindBinary.mockReturnValue('/root/go/bin/subfinder');
    mockRunTool.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    await runSubfinder('target.io');
    expect(mockRunTool).toHaveBeenCalledWith(
      '/root/go/bin/subfinder',
      ['-d', 'target.io', '-silent', '-all', '-max-time', '20'],
      { timeoutMs: 30_000 },
    );
  });

  it('handles blank lines interspersed in output', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/subfinder');
    mockRunTool.mockResolvedValue({
      stdout: 'app.example.com\n\n\ndocs.example.com\n',
      stderr: '',
      exitCode: 0,
    });

    const result = await runSubfinder('example.com');
    expect(result).toEqual(['app.example.com', 'docs.example.com']);
  });
});

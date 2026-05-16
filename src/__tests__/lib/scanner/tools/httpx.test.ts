import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/scanner/tools/runner', () => ({
  findBinary: vi.fn(),
  runTool: vi.fn(),
}));

import { findBinary, runTool } from '@/lib/scanner/tools/runner';
import { runHttpxProbe } from '@/lib/scanner/tools/httpx';

const mockFindBinary = findBinary as ReturnType<typeof vi.fn>;
const mockRunTool = runTool as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFindBinary.mockReset();
  mockRunTool.mockReset();
});

describe('runHttpxProbe', () => {
  it('returns [] when httpx binary is not installed', async () => {
    mockFindBinary.mockReturnValue(null);
    const result = await runHttpxProbe('https://example.com', ['/admin', '/.env']);
    expect(result).toEqual([]);
    expect(mockRunTool).not.toHaveBeenCalled();
  });

  it('returns [] when stdout is empty', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/httpx');
    mockRunTool.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    const result = await runHttpxProbe('https://example.com', ['/admin']);
    expect(result).toEqual([]);
  });

  it('parses a successful probe result (200)', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/httpx');
    mockRunTool.mockResolvedValue({
      stdout: 'https://example.com/admin [200]\n',
      stderr: '',
      exitCode: 0,
    });

    const result = await runHttpxProbe('https://example.com', ['/admin']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ url: 'https://example.com/admin', path: '/admin', status: 200 });
  });

  it('skips 404 responses', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/httpx');
    mockRunTool.mockResolvedValue({
      stdout: 'https://example.com/.env [404]\nhttps://example.com/admin [200]\n',
      stderr: '',
      exitCode: 0,
    });

    const result = await runHttpxProbe('https://example.com', ['/.env', '/admin']);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe(200);
  });

  it('skips 410 responses', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/httpx');
    mockRunTool.mockResolvedValue({
      stdout: 'https://example.com/gone [410]\n',
      stderr: '',
      exitCode: 0,
    });

    const result = await runHttpxProbe('https://example.com', ['/gone']);
    expect(result).toHaveLength(0);
  });

  it('includes non-404/410 status codes (301, 403, 500)', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/httpx');
    mockRunTool.mockResolvedValue({
      stdout: [
        'https://example.com/redirect [301]',
        'https://example.com/secret [403]',
        'https://example.com/broken [500]',
      ].join('\n') + '\n',
      stderr: '',
      exitCode: 0,
    });

    const result = await runHttpxProbe('https://example.com', ['/redirect', '/secret', '/broken']);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.status)).toEqual([301, 403, 500]);
  });

  it('skips lines that do not match the expected format', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/httpx');
    mockRunTool.mockResolvedValue({
      stdout: 'not-a-valid-line\nhttps://example.com/ok [200]\n',
      stderr: '',
      exitCode: 0,
    });

    const result = await runHttpxProbe('https://example.com', ['/ok']);
    expect(result).toHaveLength(1);
  });

  it('skips blank lines', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/httpx');
    mockRunTool.mockResolvedValue({
      stdout: '\n\nhttps://example.com/ok [200]\n\n',
      stderr: '',
      exitCode: 0,
    });

    const result = await runHttpxProbe('https://example.com', ['/ok']);
    expect(result).toHaveLength(1);
  });

  it('uses the origin of the baseUrl (strips path)', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/httpx');
    mockRunTool.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    await runHttpxProbe('https://example.com/some/deep/path', ['/admin']);
    // The input sent to runTool should be built from origin only
    const callArgs = mockRunTool.mock.calls[0];
    expect(callArgs[2].input).toBe('https://example.com/admin');
  });

  it('combines multiple paths into newline-separated input', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/httpx');
    mockRunTool.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    await runHttpxProbe('https://example.com', ['/a', '/b', '/c']);
    const callArgs = mockRunTool.mock.calls[0];
    expect(callArgs[2].input).toBe('https://example.com/a\nhttps://example.com/b\nhttps://example.com/c');
  });

  it('passes correct CLI flags', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/httpx');
    mockRunTool.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    await runHttpxProbe('https://example.com', ['/test']);
    expect(mockRunTool).toHaveBeenCalledWith(
      '/usr/local/bin/httpx',
      ['-silent', '-sc', '-nc', '-no-fallback', '-timeout', '8', '-rate-limit', '30'],
      expect.objectContaining({ timeoutMs: 30_000 }),
    );
  });

  it('extracts pathname correctly from matched URL', async () => {
    mockFindBinary.mockReturnValue('/usr/local/bin/httpx');
    mockRunTool.mockResolvedValue({
      stdout: 'https://example.com/api/v1/users [200]\n',
      stderr: '',
      exitCode: 0,
    });

    const result = await runHttpxProbe('https://example.com', ['/api/v1/users']);
    expect(result[0].path).toBe('/api/v1/users');
  });
});

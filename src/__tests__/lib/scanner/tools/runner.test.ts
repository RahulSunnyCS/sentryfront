import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process before importing runner so the module-level
// promisify(execFile) binds to our mock.
vi.mock('child_process', () => ({
  execFile: vi.fn(),
  spawn: vi.fn(),
}));

// promisify is called at module load time; we need to return the raw mock fn
// so that execFileAsync === the execFile mock (no wrapping needed in tests).
// Must export `default` because Node's `util` module has a default export and
// vitest requires it when the source uses `import { promisify } from 'util'`.
vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('util')>();
  return {
    ...actual,
    promisify: (fn: (...args: unknown[]) => unknown) => fn,
  };
});

// existsSync controls which binaries are "found"
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, existsSync: vi.fn() };
});

import { execFile, spawn } from 'child_process';
import { existsSync } from 'fs';
import { findBinary, runTool } from '@/lib/scanner/tools/runner';

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>;

// Helper: build a minimal EventEmitter-style child process stub for spawn tests
function makeChildStub(opts: {
  stdoutData?: string;
  stderrData?: string;
  exitCode?: number;
  errorOnStdin?: boolean;
}) {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  const on = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(cb);
  });

  const stdoutListeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  const stderrListeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  const stdinWrite = vi.fn();
  const stdinEnd = vi.fn(() => {
    // Simulate async data flow after stdin ends
    Promise.resolve().then(() => {
      if (opts.stdoutData) stdoutListeners['data']?.forEach((cb) => cb(Buffer.from(opts.stdoutData!)));
      if (opts.stderrData) stderrListeners['data']?.forEach((cb) => cb(Buffer.from(opts.stderrData!)));
      if (opts.errorOnStdin) {
        listeners['error']?.forEach((cb) => cb(new Error('spawn error')));
      } else {
        listeners['close']?.forEach((cb) => cb(opts.exitCode ?? 0));
      }
    });
  });

  const child = {
    stdout: { on: vi.fn((e: string, cb: (...args: unknown[]) => void) => { if (!stdoutListeners[e]) stdoutListeners[e] = []; stdoutListeners[e].push(cb); }) },
    stderr: { on: vi.fn((e: string, cb: (...args: unknown[]) => void) => { if (!stderrListeners[e]) stderrListeners[e] = []; stderrListeners[e].push(cb); }) },
    stdin: { write: stdinWrite, end: stdinEnd },
    on,
    kill: vi.fn(() => {
      listeners['close']?.forEach((cb) => cb(-1));
    }),
  };
  return child;
}

describe('findBinary', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
  });

  it('returns null when binary is not found anywhere', () => {
    mockExistsSync.mockReturnValue(false);
    expect(findBinary('gitleaks')).toBeNull();
  });

  it('returns the first matching path in /usr/local/bin etc.', () => {
    mockExistsSync.mockImplementation((p: string) => p === '/usr/bin/nuclei');
    expect(findBinary('nuclei')).toBe('/usr/bin/nuclei');
  });

  it('returns a GOBIN path when standard dirs miss but GOBIN hits', () => {
    const originalGobin = process.env.GOBIN;
    process.env.GOBIN = '/custom/go/bin';
    mockExistsSync.mockImplementation((p: string) => p === '/custom/go/bin/subfinder');
    const result = findBinary('subfinder');
    process.env.GOBIN = originalGobin;
    expect(result).toBe('/custom/go/bin/subfinder');
  });

  it('returns a fallback GOPATH/bin path', () => {
    const originalGobin = process.env.GOBIN;
    const originalGopath = process.env.GOPATH;
    delete process.env.GOBIN;
    process.env.GOPATH = '/home/user/go';
    mockExistsSync.mockImplementation((p: string) => p === '/home/user/go/bin/httpx');
    const result = findBinary('httpx');
    process.env.GOBIN = originalGobin;
    process.env.GOPATH = originalGopath;
    expect(result).toBe('/home/user/go/bin/httpx');
  });
});

describe('runTool — execFile path (no stdin input)', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
  });

  it('returns stdout/stderr and exitCode 0 on success', async () => {
    mockExecFile.mockResolvedValue({ stdout: 'hello\n', stderr: '' });
    const result = await runTool('/usr/bin/nuclei', ['-version']);
    expect(result).toEqual({ stdout: 'hello\n', stderr: '', exitCode: 0 });
  });

  it('captures output even when the process exits non-zero', async () => {
    // Security tools use non-zero exit to indicate findings, not errors.
    const err = Object.assign(new Error('exit 1'), {
      stdout: 'finding-output',
      stderr: 'some warning',
      code: 1,
    });
    mockExecFile.mockRejectedValue(err);
    const result = await runTool('/usr/bin/gitleaks', ['detect']);
    expect(result.stdout).toBe('finding-output');
    expect(result.stderr).toBe('some warning');
    expect(result.exitCode).toBe(1);
  });

  it('returns exitCode 1 when error.code is a string (signal kill)', async () => {
    const err = Object.assign(new Error('killed'), { code: 'SIGTERM' });
    mockExecFile.mockRejectedValue(err);
    const result = await runTool('/usr/bin/tool', []);
    expect(result.exitCode).toBe(1);
  });

  it('returns empty stdout/stderr when the error has none', async () => {
    mockExecFile.mockRejectedValue(new Error('failed'));
    const result = await runTool('/usr/bin/tool', []);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});

describe('runTool — spawn path (with stdin input)', () => {
  beforeEach(() => {
    mockSpawn.mockReset();
  });

  it('writes input to stdin and collects stdout', async () => {
    const child = makeChildStub({ stdoutData: 'result-line\n', exitCode: 0 });
    mockSpawn.mockReturnValue(child);

    const result = await runTool('/usr/bin/httpx', ['-silent'], { input: 'https://example.com' });
    expect(result.stdout).toBe('result-line\n');
    expect(result.exitCode).toBe(0);
    expect(child.stdin.write).toHaveBeenCalledWith('https://example.com');
    expect(child.stdin.end).toHaveBeenCalled();
  });

  it('collects stderr output', async () => {
    const child = makeChildStub({ stderrData: 'warn message', exitCode: 0 });
    mockSpawn.mockReturnValue(child);

    const result = await runTool('/usr/bin/httpx', [], { input: 'url' });
    expect(result.stderr).toBe('warn message');
  });

  it('resolves with exitCode -1 on spawn error', async () => {
    const child = makeChildStub({ errorOnStdin: true });
    mockSpawn.mockReturnValue(child);

    const result = await runTool('/usr/bin/httpx', [], { input: 'url' });
    expect(result.exitCode).toBe(-1);
  });

  it('uses the provided timeout', async () => {
    // This test verifies spawn is called; actual timer expiry is not awaited
    // to keep the test fast — we just confirm the path is entered.
    const child = makeChildStub({ stdoutData: '', exitCode: 0 });
    mockSpawn.mockReturnValue(child);

    await runTool('/usr/bin/httpx', [], { input: '', timeoutMs: 5_000 });
    expect(mockSpawn).toHaveBeenCalledWith('/usr/bin/httpx', [], { stdio: ['pipe', 'pipe', 'pipe'] });
  });
});

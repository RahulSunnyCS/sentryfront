import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- child_process mock ---
// Must spread the real module so vitest does not complain about a missing
// `default` export on a Node built-in.  We override only execFile / spawn.
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, execFile: vi.fn(), spawn: vi.fn() };
});

// --- util mock ---
// `promisify` is called at module-load time inside runner.ts.  We want
// execFileAsync to call OUR execFile mock, so we make promisify return
// the function it receives unchanged (i.e. no wrapping).
// Spread the actual module to preserve the `default` export.
vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('util')>();
  return {
    ...actual,
    promisify: (fn: (...args: unknown[]) => unknown) => fn,
  };
});

// --- fs mock ---
// existsSync controls which binaries are "found".  We need importOriginal
// so the rest of the `fs` API keeps working (mkdtempSync etc.).
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, existsSync: vi.fn() };
});

import { execFile, spawn } from 'child_process';
import { existsSync } from 'fs';
import { findBinary, runTool } from '@/lib/scanner/tools/runner';

// Cast to vi.fn so TypeScript lets us call .mockReturnValue etc.
const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helper: build a minimal EventEmitter-style child-process stub for spawn tests.
// ---------------------------------------------------------------------------
function makeChildStub(opts: {
  stdoutData?: string;
  stderrData?: string;
  exitCode?: number;
  errorOnClose?: boolean;
}) {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  const stdoutListeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  const stderrListeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  const on = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    listeners[event] = listeners[event] ?? [];
    listeners[event].push(cb);
  });

  const stdinEnd = vi.fn(() => {
    // Simulate async data arrival then close, just like a real child process.
    Promise.resolve().then(() => {
      if (opts.stdoutData) {
        stdoutListeners['data']?.forEach((cb) => cb(Buffer.from(opts.stdoutData!)));
      }
      if (opts.stderrData) {
        stderrListeners['data']?.forEach((cb) => cb(Buffer.from(opts.stderrData!)));
      }
      if (opts.errorOnClose) {
        listeners['error']?.forEach((cb) => cb(new Error('spawn error')));
      } else {
        listeners['close']?.forEach((cb) => cb(opts.exitCode ?? 0));
      }
    });
  });

  return {
    stdout: {
      on: vi.fn((e: string, cb: (...args: unknown[]) => void) => {
        stdoutListeners[e] = stdoutListeners[e] ?? [];
        stdoutListeners[e].push(cb);
      }),
    },
    stderr: {
      on: vi.fn((e: string, cb: (...args: unknown[]) => void) => {
        stderrListeners[e] = stderrListeners[e] ?? [];
        stderrListeners[e].push(cb);
      }),
    },
    stdin: { write: vi.fn(), end: stdinEnd },
    on,
    kill: vi.fn(() => {
      listeners['close']?.forEach((cb) => cb(-1));
    }),
  };
}

// ---------------------------------------------------------------------------
// findBinary
// ---------------------------------------------------------------------------
describe('findBinary', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
  });

  it('returns null when the binary is not found in any location', () => {
    mockExistsSync.mockReturnValue(false);
    expect(findBinary('gitleaks')).toBeNull();
  });

  it('returns the matching path from /usr/bin when it exists', () => {
    // Only the /usr/bin/<name> path returns true; every other path is false.
    mockExistsSync.mockImplementation((p: string) => p === '/usr/bin/nuclei');
    expect(findBinary('nuclei')).toBe('/usr/bin/nuclei');
  });

  it('returns a GOBIN path when standard dirs miss but GOBIN hits', () => {
    const savedGobin = process.env.GOBIN;
    process.env.GOBIN = '/custom/go/bin';
    // Standard dirs return false; GOBIN path returns true.
    mockExistsSync.mockImplementation((p: string) => p === '/custom/go/bin/subfinder');
    const result = findBinary('subfinder');
    process.env.GOBIN = savedGobin;
    expect(result).toBe('/custom/go/bin/subfinder');
  });

  it('returns a GOPATH/bin path when GOBIN is unset', () => {
    const savedGobin = process.env.GOBIN;
    const savedGopath = process.env.GOPATH;
    delete process.env.GOBIN;
    process.env.GOPATH = '/workspace/go';
    mockExistsSync.mockImplementation((p: string) => p === '/workspace/go/bin/httpx');
    const result = findBinary('httpx');
    process.env.GOBIN = savedGobin;
    process.env.GOPATH = savedGopath;
    expect(result).toBe('/workspace/go/bin/httpx');
  });

  it('returns the hardcoded /root/go/bin fallback', () => {
    const savedGobin = process.env.GOBIN;
    const savedGopath = process.env.GOPATH;
    delete process.env.GOBIN;
    delete process.env.GOPATH;
    mockExistsSync.mockImplementation((p: string) => p === '/root/go/bin/subfinder');
    const result = findBinary('subfinder');
    process.env.GOBIN = savedGobin;
    process.env.GOPATH = savedGopath;
    expect(result).toBe('/root/go/bin/subfinder');
  });
});

// ---------------------------------------------------------------------------
// runTool — execFile path (no stdin input provided)
// ---------------------------------------------------------------------------
describe('runTool — execFile path (no stdin input)', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
  });

  it('returns stdout/stderr and exitCode 0 on success', async () => {
    // promisify(execFile) is our mock fn; resolve it with the expected shape.
    mockExecFile.mockResolvedValue({ stdout: 'hello\n', stderr: '' });
    const result = await runTool('/usr/bin/nuclei', ['-version']);
    expect(result).toEqual({ stdout: 'hello\n', stderr: '', exitCode: 0 });
  });

  it('captures output even when the process exits non-zero', async () => {
    // Many security tools use a non-zero exit code to signal findings.
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

  it('returns exitCode 1 when error.code is a non-numeric string (SIGTERM kill)', async () => {
    const err = Object.assign(new Error('killed'), { code: 'SIGTERM' });
    mockExecFile.mockRejectedValue(err);
    const result = await runTool('/usr/bin/tool', []);
    expect(result.exitCode).toBe(1);
  });

  it('returns empty stdout/stderr when the error carries none', async () => {
    mockExecFile.mockRejectedValue(new Error('failed'));
    const result = await runTool('/usr/bin/tool', []);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('passes args directly to execFile', async () => {
    mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });
    await runTool('/usr/bin/nuclei', ['-u', 'https://example.com', '-j']);
    expect(mockExecFile).toHaveBeenCalledWith(
      '/usr/bin/nuclei',
      ['-u', 'https://example.com', '-j'],
      expect.objectContaining({ timeout: 30_000 }),
    );
  });

  it('honours a custom timeoutMs', async () => {
    mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });
    await runTool('/usr/bin/tool', [], { timeoutMs: 5_000 });
    expect(mockExecFile).toHaveBeenCalledWith(
      '/usr/bin/tool',
      [],
      expect.objectContaining({ timeout: 5_000 }),
    );
  });
});

// ---------------------------------------------------------------------------
// runTool — spawn path (stdin input provided)
// ---------------------------------------------------------------------------
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

  it('collects stderr alongside stdout', async () => {
    const child = makeChildStub({ stderrData: 'warn message', exitCode: 0 });
    mockSpawn.mockReturnValue(child);

    const result = await runTool('/usr/bin/httpx', [], { input: 'url' });
    expect(result.stderr).toBe('warn message');
  });

  it('resolves with exitCode -1 when the child emits an error', async () => {
    const child = makeChildStub({ errorOnClose: true });
    mockSpawn.mockReturnValue(child);

    const result = await runTool('/usr/bin/httpx', [], { input: 'url' });
    expect(result.exitCode).toBe(-1);
  });

  it('spawns the process with piped stdio', async () => {
    const child = makeChildStub({ exitCode: 0 });
    mockSpawn.mockReturnValue(child);

    await runTool('/usr/bin/httpx', ['-silent'], { input: '' });
    expect(mockSpawn).toHaveBeenCalledWith(
      '/usr/bin/httpx',
      ['-silent'],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
  });

  it('returns exitCode from the close event', async () => {
    const child = makeChildStub({ exitCode: 42 });
    mockSpawn.mockReturnValue(child);

    const result = await runTool('/usr/bin/httpx', [], { input: 'u' });
    expect(result.exitCode).toBe(42);
  });
});

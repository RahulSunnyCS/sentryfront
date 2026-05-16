import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures mock variables are available when vi.mock factory functions
// run — vi.mock calls are hoisted above import statements by vitest.
const { mockExistsSync, mockExecFile, mockSpawn } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockExecFile: vi.fn(),
  mockSpawn: vi.fn(),
}));

// Use factory form WITHOUT importOriginal for Node built-ins.
// When importOriginal is used for CJS built-ins, named exports in the spread
// resolve to the original (non-mock) functions. The factory form completely
// replaces the module namespace so the named imports inside runner.ts bind
// to our mocks at module-load time.

vi.mock('child_process', () => ({
  execFile: mockExecFile,
  spawn: mockSpawn,
  default: { execFile: mockExecFile, spawn: mockSpawn },
}));

// promisify is called at module-load time inside runner.ts to wrap execFile.
// Returning the function unchanged makes execFileAsync === mockExecFile so
// tests can control its behaviour.
vi.mock('util', () => ({
  promisify: (fn: (...args: unknown[]) => unknown) => fn,
  default: { promisify: (fn: (...args: unknown[]) => unknown) => fn },
}));

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  // gitleaks.ts uses additional fs functions; define them here so the shared
  // 'fs' mock works for all tool tests imported from this file.
  mkdtempSync: vi.fn(() => '/tmp/vibesafe-test'),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  rmSync: vi.fn(),
  default: { existsSync: mockExistsSync },
}));

import { findBinary, runTool } from '@/lib/scanner/tools/runner';

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
    // Simulate async data arrival then process close, like a real child process.
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
    // Only /usr/bin/nuclei returns true; every other candidate is false.
    mockExistsSync.mockImplementation((p: string) => p === '/usr/bin/nuclei');
    expect(findBinary('nuclei')).toBe('/usr/bin/nuclei');
  });

  // GOBIN_CANDIDATES is evaluated at module-load time, so dynamic GOBIN/GOPATH
  // env-var changes after module import have no effect on these tests.
  // Instead we test the hardcoded fallback paths that are always in the list.

  it('returns the hardcoded /root/go/bin fallback path', () => {
    mockExistsSync.mockImplementation((p: string) => p === '/root/go/bin/subfinder');
    expect(findBinary('subfinder')).toBe('/root/go/bin/subfinder');
  });

  it('returns the /home/user/go/bin fallback path', () => {
    mockExistsSync.mockImplementation((p: string) => p === '/home/user/go/bin/httpx');
    expect(findBinary('httpx')).toBe('/home/user/go/bin/httpx');
  });

  it('returns the hardcoded /root/go/bin fallback when everything else misses', () => {
    const savedGobin = process.env.GOBIN;
    const savedGopath = process.env.GOPATH;
    delete process.env.GOBIN;
    delete process.env.GOPATH;
    mockExistsSync.mockImplementation((p: string) => p === '/root/go/bin/nuclei');
    const result = findBinary('nuclei');
    process.env.GOBIN = savedGobin;
    process.env.GOPATH = savedGopath;
    expect(result).toBe('/root/go/bin/nuclei');
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
    // promisify(execFile) is mockExecFile; resolve it with the expected shape.
    mockExecFile.mockResolvedValue({ stdout: 'hello\n', stderr: '' });
    const result = await runTool('/usr/bin/nuclei', ['-version']);
    expect(result).toEqual({ stdout: 'hello\n', stderr: '', exitCode: 0 });
  });

  it('captures output even when the process exits non-zero', async () => {
    // Many security tools use a non-zero exit code to signal findings, not errors.
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

  it('returns exitCode 1 when error.code is a non-numeric string (SIGTERM)', async () => {
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

  it('passes binary and args to execFile', async () => {
    mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });
    await runTool('/usr/bin/nuclei', ['-u', 'https://example.com', '-j']);
    expect(mockExecFile).toHaveBeenCalledWith(
      '/usr/bin/nuclei',
      ['-u', 'https://example.com', '-j'],
      expect.objectContaining({ timeout: 30_000 }),
    );
  });

  it('honours a custom timeoutMs in the execFile options', async () => {
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

  it('returns exitCode 0 on a clean exit', async () => {
    const child = makeChildStub({ exitCode: 0 });
    mockSpawn.mockReturnValue(child);

    const result = await runTool('/usr/bin/httpx', [], { input: 'u' });
    expect(result.exitCode).toBe(0);
  });

  it('returns empty strings for stdout and stderr when no data is emitted', async () => {
    const child = makeChildStub({ exitCode: 0 });
    mockSpawn.mockReturnValue(child);

    const result = await runTool('/usr/bin/httpx', [], { input: 'u' });
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});

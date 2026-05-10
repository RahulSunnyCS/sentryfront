import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import * as path from 'path';

const execFileAsync = promisify(execFile);

// Candidate binary locations in priority order
const GOBIN_CANDIDATES = [
  process.env.GOBIN,
  process.env.GOPATH ? path.join(process.env.GOPATH, 'bin') : null,
  '/root/go/bin',
  '/usr/local/go/bin',
  '/home/user/go/bin',
].filter((p): p is string => Boolean(p));

export function findBinary(name: string): string | null {
  // Check PATH first
  const fromPath = ['usr/local/bin', '/usr/bin', '/bin']
    .map((dir) => path.join(dir, name))
    .find(existsSync);
  if (fromPath) return fromPath;

  for (const dir of GOBIN_CANDIDATES) {
    const full = path.join(dir, name);
    if (existsSync(full)) return full;
  }
  return null;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runTool(
  binary: string,
  args: string[],
  opts: { timeoutMs?: number; input?: string } = {},
): Promise<RunResult> {
  const { timeoutMs = 30_000, input } = opts;

  // Use spawn when we need to write to stdin
  if (input !== undefined) {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      const child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      const timer = setTimeout(() => { child.kill(); resolve({ stdout, stderr, exitCode: -1 }); }, timeoutMs);
      child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      child.on('close', (code) => { clearTimeout(timer); resolve({ stdout, stderr, exitCode: code ?? 0 }); });
      child.on('error', () => { clearTimeout(timer); resolve({ stdout, stderr, exitCode: -1 }); });
      child.stdin.write(input);
      child.stdin.end();
    });
  }

  try {
    const { stdout, stderr } = await execFileAsync(binary, args, {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: String(stdout), stderr: String(stderr), exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number | string };
    // Many security tools use non-zero exit to signal findings (not errors)
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: typeof e.code === 'number' ? e.code : 1,
    };
  }
}

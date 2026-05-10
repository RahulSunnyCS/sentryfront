/**
 * subfinder wrapper — MIT licensed, safe for commercial use.
 * Passive subdomain discovery via multiple sources.
 * Falls back gracefully to crt.sh-only if not installed.
 */

import { findBinary, runTool } from './runner';

export async function runSubfinder(apex: string): Promise<string[]> {
  const binary = findBinary('subfinder');
  if (!binary) return []; // caller falls back to crt.sh

  const result = await runTool(
    binary,
    [
      '-d', apex,
      '-silent',
      '-all',         // use all passive sources
      '-max-time', '20',
    ],
    { timeoutMs: 30_000 },
  );

  return result.stdout
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s && s.endsWith(`.${apex}`))
    .slice(0, 50); // cap at 50 for takeover checks
}

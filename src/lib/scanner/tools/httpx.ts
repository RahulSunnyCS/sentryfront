/**
 * httpx wrapper — MIT licensed (ProjectDiscovery), safe for commercial use.
 * Fast parallel HTTP probing with status codes.
 * Used to augment sensitive-path probing in P1-06.
 */

import { findBinary, runTool } from './runner';

export interface HttpxResult {
  url: string;
  path: string;
  status: number;
}

export async function runHttpxProbe(
  baseUrl: string,
  paths: string[],
): Promise<HttpxResult[]> {
  const binary = findBinary('httpx');
  if (!binary) return [];

  const base = new URL(baseUrl).origin;
  const urls = paths.map((p) => `${base}${p}`).join('\n');

  const result = await runTool(
    binary,
    [
      '-silent',
      '-sc',          // include status code
      '-nc',          // no color
      '-no-fallback',
      '-timeout', '8',
      '-rate-limit', '30',
    ],
    { input: urls, timeoutMs: 30_000 },
  );

  const hits: HttpxResult[] = [];
  for (const line of result.stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // httpx output format: https://host/path [STATUS]
    const m = /^(https?:\/\/[^\s]+)\s+\[(\d+)\]/.exec(trimmed);
    if (!m) continue;
    const status = parseInt(m[2], 10);
    if (status === 404 || status === 410) continue;
    try {
      const parsed = new URL(m[1]);
      hits.push({ url: m[1], path: parsed.pathname, status });
    } catch { /* skip */ }
  }

  return hits;
}

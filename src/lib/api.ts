/**
 * Browser-only API client — calls Next.js API routes at the same origin.
 * Only call these functions from client components ('use client').
 * Server components should query Prisma directly.
 */

import type { ScanData, Finding } from '@/types';
import { BAD_SCAN } from './data';

const BASE = '/api/v1';

export interface CreateScanResult {
  id: string;
  status: string;
  targetUrl: string;
}

export async function createScan(url: string): Promise<CreateScanResult> {
  const res = await fetch(`${BASE}/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }

  return res.json();
}

export async function getScan(id: string): Promise<ScanData> {
  // "demo" is the fixture scan rendered without a real DB record.
  if (id === 'demo') return BAD_SCAN;

  const [scanRes, findingsRes] = await Promise.all([
    fetch(`${BASE}/scans/${id}`),
    fetch(`${BASE}/scans/${id}/findings`),
  ]);

  if (!scanRes.ok) throw new Error(`Scan not found (${scanRes.status})`);

  const scan = await scanRes.json();
  const findings: Finding[] = findingsRes.ok ? await findingsRes.json() : [];

  return {
    id: scan.id,
    url: scan.targetUrl,
    grade: scan.grade ?? 'F',
    score: scan.score ?? 0,
    stack: scan.stack ?? 'Unknown',
    date: new Date(scan.startedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    duration: scan.completedAt
      ? `${Math.round((new Date(scan.completedAt).getTime() - new Date(scan.startedAt).getTime()) / 1000)}s`
      : '—',
    status: scan.status,
    summary: scan.summary ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
    moduleResults: {},
    findings,
  };
}

/** Returns an EventSource for real-time scan progress, or null for the demo scan. */
export function openScanStream(id: string): EventSource | null {
  if (id === 'demo') return null;
  return new EventSource(`${BASE}/scans/${id}/stream`);
}

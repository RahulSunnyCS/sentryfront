/**
 * Browser-only API client — calls Next.js API routes at the same origin.
 * Only call these functions from client components ('use client').
 * Server components should query Prisma directly.
 */

import type { ScanData, Finding } from '@/types';
import { BAD_SCAN } from './data';

const BASE = '/api/v1';

// ─── Typed error classes ─────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class PaymentRequiredError extends ApiError {
  constructor(message: string, data: Record<string, unknown> = {}) {
    super(402, message, data);
    this.name = 'PaymentRequiredError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string, data: Record<string, unknown> = {}) {
    super(429, message, data);
    this.name = 'RateLimitError';
  }
}

// ─── API helpers ─────────────────────────────────────────────────────────────

export interface CreateScanResult {
  id: string;
  status: string;
  targetUrl: string;
  inputType?: string;
}

export async function createScan(url: string): Promise<CreateScanResult> {
  const res = await fetch(`${BASE}/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = (body.error as string) ?? `Request failed (${res.status})`;
    if (res.status === 402) throw new PaymentRequiredError(msg, body);
    if (res.status === 429) throw new RateLimitError(msg, body);
    throw new ApiError(res.status, msg, body);
  }

  return res.json();
}

export async function createMobileScan(file: File, platform: 'apk' | 'ipa'): Promise<CreateScanResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('platform', platform);

  const res = await fetch(`${BASE}/scans`, {
    method: 'POST',
    body: formData,
    // Do NOT set Content-Type — browser sets it with boundary automatically
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = (body.error as string) ?? `Request failed (${res.status})`;
    if (res.status === 402) throw new PaymentRequiredError(msg, body);
    if (res.status === 429) throw new RateLimitError(msg, body);
    throw new ApiError(res.status, msg, body);
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

  if (!scanRes.ok) throw new ApiError(scanRes.status, `Scan not found (${scanRes.status})`);

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

export interface ScanEventEnvelope {
  id: number;
  type: string;
  payload: Record<string, unknown>;
}

export interface ScanEventsResponse {
  scan: { id: string; status: string; grade: string | null };
  events: ScanEventEnvelope[];
  cursor: number;
}

export async function fetchScanEvents(id: string, since: number): Promise<ScanEventsResponse> {
  const res = await fetch(`${BASE}/scans/${id}/events?since=${since}`, { cache: 'no-store' });
  if (!res.ok) throw new ApiError(res.status, `Scan events request failed (${res.status})`);
  return res.json();
}

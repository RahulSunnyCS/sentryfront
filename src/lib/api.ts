import { apiUrl, isMockMode } from './config';
import { BAD_SCAN } from './data';
import type { ScanData } from '@/types';

// Returned when a scan is created. In mock mode the id is always "demo".
export interface CreateScanResult {
  id: string;
  mock: boolean;
}

export async function createScan(targetUrl: string): Promise<CreateScanResult> {
  if (isMockMode) {
    return { id: 'demo', mock: true };
  }

  const res = await fetch(`${apiUrl}/api/v1/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: targetUrl }),
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return { id: data.id, mock: false };
}

export async function getScan(id: string): Promise<ScanData> {
  if (isMockMode || id === 'demo') {
    return BAD_SCAN;
  }

  const res = await fetch(`${apiUrl}/api/v1/scans/${id}`);
  if (!res.ok) {
    throw new Error(`API error ${res.status}`);
  }
  return res.json();
}

// Returns an EventSource for real-time scan progress.
// In mock mode returns null — callers simulate progress with a timer instead.
export function openScanStream(id: string): EventSource | null {
  if (isMockMode || id === 'demo') return null;
  return new EventSource(`${apiUrl}/api/v1/scans/${id}/stream`);
}

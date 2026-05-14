'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Scan {
  id: string;
  targetUrl: string;
  status: string;
  tier: string;
  userId: string | null;
  grade: string | null;
  score: number | null;
  startedAt: string;
  completedAt: string | null;
}

export function ScanRerunView({ scan }: { scan: Scan }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newId, setNewId] = useState<string | null>(null);

  async function rerun() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/internal/scans/${encodeURIComponent(scan.id)}/rerun`, {
        method: 'POST',
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; newScanId?: string };
      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setNewId(body.newScanId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Scan</h1>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <dt className="text-white/50">id</dt>
        <dd className="font-mono">{scan.id}</dd>
        <dt className="text-white/50">targetUrl</dt>
        <dd>{scan.targetUrl}</dd>
        <dt className="text-white/50">status</dt>
        <dd>{scan.status}</dd>
        <dt className="text-white/50">tier</dt>
        <dd>{scan.tier}</dd>
        <dt className="text-white/50">grade / score</dt>
        <dd>
          {scan.grade ?? '—'} / {scan.score ?? '—'}
        </dd>
        <dt className="text-white/50">userId</dt>
        <dd className="font-mono">{scan.userId ?? '—'}</dd>
        <dt className="text-white/50">startedAt</dt>
        <dd>{scan.startedAt}</dd>
        <dt className="text-white/50">completedAt</dt>
        <dd>{scan.completedAt ?? '—'}</dd>
      </dl>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={rerun}
          className="rounded bg-emerald-500/30 hover:bg-emerald-500/50 px-4 py-2 text-sm"
        >
          {busy ? 'Re-running…' : 'Re-run scan'}
        </button>
        <Link
          href={`/report/${scan.id}`}
          className="rounded bg-white/10 hover:bg-white/20 px-3 py-2 text-sm"
        >
          View report
        </Link>
      </div>

      {error && (
        <div className="mt-3 rounded border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      {newId && (
        <div className="mt-3 rounded border border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Re-run queued. New scan:{' '}
          <Link href={`/internal/scans/${newId}`} className="underline font-mono">
            {newId}
          </Link>
        </div>
      )}
    </div>
  );
}

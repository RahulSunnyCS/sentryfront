'use client';

import { useState } from 'react';

interface Row {
  id: string;
  scanId: string;
  findingId: string;
  userId: string;
  disposition: string;
  createdAt: string;
  moduleId: string | null;
  title: string | null;
  severity: string | null;
}

const DISPOSITION_TONE: Record<string, string> = {
  helpful: 'text-emerald-300',
  dismissed: 'text-white/60',
  fp: 'text-red-300',
  fix_didnt_help: 'text-amber-300',
  missed_other: 'text-sky-300',
};

export function DispositionsView() {
  const [moduleId, setModuleId] = useState('');
  const [userId, setUserId] = useState('');
  const [scanId, setScanId] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    const params = new URLSearchParams();
    if (moduleId) params.set('moduleId', moduleId);
    if (userId) params.set('userId', userId);
    if (scanId) params.set('scanId', scanId);
    params.set('limit', '100');
    try {
      const res = await fetch(`/api/internal/dispositions?${params.toString()}`);
      if (!res.ok) {
        setError(`Request failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as { rows: Row[] };
      setRows(body.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Dispositions</h1>
      <p className="text-sm text-white/60 mt-1">
        Includes recall-side reports — disposition{' '}
        <span className="font-mono text-sky-300">missed_other</span> uses a synthetic findingId
        of the form <span className="font-mono">missed:&lt;scanId&gt;:&lt;moduleHint&gt;:&lt;uuid&gt;</span>.
      </p>

      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <input
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
          placeholder="moduleId (e.g. P1-05)"
          className="rounded bg-white/5 border border-white/10 px-3 py-1.5 text-sm w-56"
        />
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="userId"
          className="rounded bg-white/5 border border-white/10 px-3 py-1.5 text-sm w-56"
        />
        <input
          value={scanId}
          onChange={(e) => setScanId(e.target.value)}
          placeholder="scanId"
          className="rounded bg-white/5 border border-white/10 px-3 py-1.5 text-sm w-56"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-white/10 hover:bg-white/20 px-3 py-1.5 text-sm"
        >
          Filter
        </button>
      </form>

      {error && (
        <div className="mt-3 rounded border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <table className="mt-6 w-full text-xs">
        <thead className="text-left text-white/50 uppercase tracking-wide">
          <tr>
            <th className="py-2 pr-4">When</th>
            <th className="py-2 pr-4">Disposition</th>
            <th className="py-2 pr-4">Module</th>
            <th className="py-2 pr-4">Severity</th>
            <th className="py-2 pr-4">Title</th>
            <th className="py-2 pr-4">Scan</th>
            <th className="py-2 pr-4">User</th>
            <th className="py-2 pr-4">Finding</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="py-4 text-white/40">
                No rows yet — apply filters and search.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-white/10">
              <td className="py-1.5 pr-4 text-white/60">
                {new Date(r.createdAt).toISOString().slice(0, 16).replace('T', ' ')}
              </td>
              <td className={`py-1.5 pr-4 font-mono ${DISPOSITION_TONE[r.disposition] ?? ''}`}>
                {r.disposition}
              </td>
              <td className="py-1.5 pr-4 font-mono">{r.moduleId ?? '—'}</td>
              <td className="py-1.5 pr-4">{r.severity ?? '—'}</td>
              <td className="py-1.5 pr-4">{r.title ?? '—'}</td>
              <td className="py-1.5 pr-4 font-mono text-white/50">
                {r.scanId.slice(0, 10)}…
              </td>
              <td className="py-1.5 pr-4 font-mono text-white/50">
                {r.userId.slice(0, 10)}…
              </td>
              <td className="py-1.5 pr-4 font-mono text-white/50">
                {r.findingId.startsWith('missed:') ? 'missed' : r.findingId.slice(0, 10) + '…'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

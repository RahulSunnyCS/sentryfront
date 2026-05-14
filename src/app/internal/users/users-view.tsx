'use client';

import { useState } from 'react';

interface UserRow {
  id: string;
  email: string | null;
  tier: string;
  scansThisWeek: number;
  scanWeekStart: string | null;
  activeTestCredits: number;
  createdAt: string;
}

export function UsersView() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  async function search(query: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/internal/users?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        setError(`Request failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as { users: UserRow[] };
      setResults(body.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  async function applyQuota(
    id: string,
    payload: { scansThisWeek?: number; activeTestCredits?: number; tier?: string },
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/internal/users/${encodeURIComponent(id)}/quota`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as { user: UserRow };
      setResults((prev) => prev.map((u) => (u.id === body.user.id ? { ...u, ...body.user } : u)));
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
      <p className="text-sm text-white/60 mt-1">
        Search by email substring; override weekly quota, active-test credits, or tier.
      </p>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search(q.trim());
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="email substring"
          className="rounded bg-white/5 border border-white/10 px-3 py-1.5 text-sm w-72"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-white/10 hover:bg-white/20 px-3 py-1.5 text-sm"
        >
          Search
        </button>
      </form>

      {error && (
        <div className="mt-3 rounded border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {results.length === 0 && (
          <p className="text-sm text-white/50">No results yet.</p>
        )}
        {results.map((u) => (
          <div key={u.id} className="rounded border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-sm">{u.email ?? '(no email)'}</div>
                <div className="text-xs text-white/50">
                  tier: {u.tier} · scansThisWeek: {u.scansThisWeek} · credits:{' '}
                  {u.activeTestCredits}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(editing === u.id ? null : u.id)}
                className="rounded bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs"
              >
                {editing === u.id ? 'Cancel' : 'Edit quota'}
              </button>
            </div>
            {editing === u.id && (
              <QuotaForm row={u} busy={busy} onSubmit={(data) => applyQuota(u.id, data)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuotaForm({
  row,
  busy,
  onSubmit,
}: {
  row: UserRow;
  busy: boolean;
  onSubmit: (data: { scansThisWeek?: number; activeTestCredits?: number; tier?: string }) => void;
}) {
  const [scans, setScans] = useState(String(row.scansThisWeek));
  const [credits, setCredits] = useState(String(row.activeTestCredits));
  const [tier, setTier] = useState(row.tier);
  return (
    <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
      <label className="flex flex-col">
        <span className="text-xs text-white/50">scansThisWeek</span>
        <input
          value={scans}
          onChange={(e) => setScans(e.target.value)}
          className="rounded bg-black/40 border border-white/10 px-2 py-1"
        />
      </label>
      <label className="flex flex-col">
        <span className="text-xs text-white/50">activeTestCredits</span>
        <input
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          className="rounded bg-black/40 border border-white/10 px-2 py-1"
        />
      </label>
      <label className="flex flex-col">
        <span className="text-xs text-white/50">tier</span>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="rounded bg-black/40 border border-white/10 px-2 py-1"
        >
          <option value="free">free</option>
          <option value="one-shot">one-shot</option>
          <option value="pro">pro</option>
          <option value="studio">studio</option>
        </select>
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          const data: { scansThisWeek?: number; activeTestCredits?: number; tier?: string } = {};
          const s = Number.parseInt(scans, 10);
          const c = Number.parseInt(credits, 10);
          if (Number.isFinite(s) && s !== row.scansThisWeek) data.scansThisWeek = s;
          if (Number.isFinite(c) && c !== row.activeTestCredits) data.activeTestCredits = c;
          if (tier !== row.tier) data.tier = tier;
          onSubmit(data);
        }}
        className="col-span-3 rounded bg-emerald-500/30 hover:bg-emerald-500/50 px-3 py-1.5 text-sm"
      >
        Save changes
      </button>
    </div>
  );
}

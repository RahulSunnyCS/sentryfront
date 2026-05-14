'use client';

import { useState } from 'react';

interface CronInfo {
  name: string;
  description: string;
}

interface RunState {
  busy: boolean;
  lastResult: unknown;
  error: string | null;
}

export function CronView({ crons }: { crons: CronInfo[] }) {
  const [state, setState] = useState<Record<string, RunState>>({});

  async function run(name: string) {
    setState((s) => ({ ...s, [name]: { busy: true, lastResult: null, error: null } }));
    try {
      const res = await fetch(`/api/internal/cron/run/${encodeURIComponent(name)}`, {
        method: 'POST',
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; result?: unknown };
      if (!res.ok) {
        setState((s) => ({
          ...s,
          [name]: { busy: false, lastResult: null, error: body.error ?? `HTTP ${res.status}` },
        }));
        return;
      }
      setState((s) => ({
        ...s,
        [name]: { busy: false, lastResult: body.result ?? body, error: null },
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        [name]: {
          busy: false,
          lastResult: null,
          error: err instanceof Error ? err.message : 'Network error',
        },
      }));
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Cron</h1>
      <p className="text-sm text-white/60 mt-1">
        Force-run a whitelisted cron in-process. Each handler is responsible for its own
        idempotency.
      </p>
      <div className="mt-6 space-y-3">
        {crons.map((c) => {
          const s = state[c.name];
          return (
            <div key={c.name} className="rounded border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-sm">{c.name}</div>
                  <div className="text-xs text-white/50 mt-1">{c.description}</div>
                </div>
                <button
                  type="button"
                  disabled={s?.busy}
                  onClick={() => run(c.name)}
                  className="rounded bg-white/10 hover:bg-white/20 px-3 py-1.5 text-sm"
                >
                  {s?.busy ? 'Running…' : 'Run now'}
                </button>
              </div>
              {s?.error && (
                <div className="mt-2 text-xs text-red-300">{s.error}</div>
              )}
              {s?.lastResult !== undefined && s.lastResult !== null && (
                <pre className="mt-2 overflow-auto rounded bg-black/40 border border-white/10 p-2 text-xs">
                  {JSON.stringify(s.lastResult, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

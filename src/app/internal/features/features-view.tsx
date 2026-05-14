'use client';

import { useState } from 'react';

interface AuditEntry {
  id: string;
  enabled: boolean;
  value: string | null;
  updatedBy: string | null;
  createdAt: string;
}

interface Flag {
  key: string;
  enabled: boolean;
  value: string | null;
  updatedBy: string | null;
  updatedAt: string;
  recentAudit: AuditEntry[];
}

export function FeaturesView({ initial }: { initial: Flag[] }) {
  const [flags, setFlags] = useState<Flag[]>(initial);
  const [newKey, setNewKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function flip(key: string, enabled: boolean, rawValue: string | null) {
    setPending(key);
    setError(null);
    let parsedValue: unknown = undefined;
    if (rawValue && rawValue.trim().length > 0) {
      try {
        parsedValue = JSON.parse(rawValue);
      } catch {
        setError(`Value for "${key}" must be valid JSON.`);
        setPending(null);
        return;
      }
    }
    try {
      const res = await fetch(`/api/internal/features/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, value: parsedValue }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Request failed with ${res.status}`);
        return;
      }
      const body = (await res.json()) as {
        key: string;
        enabled: boolean;
        value: string | null;
        updatedBy: string | null;
        updatedAt: string;
      };
      setFlags((prev) => {
        const existing = prev.find((f) => f.key === body.key);
        const updated: Flag = {
          key: body.key,
          enabled: body.enabled,
          value: body.value,
          updatedBy: body.updatedBy,
          updatedAt: body.updatedAt,
          recentAudit: existing?.recentAudit ?? [],
        };
        if (existing) {
          return prev.map((f) => (f.key === body.key ? updated : f));
        }
        return [...prev, updated].sort((a, b) => a.key.localeCompare(b.key));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Feature flags</h1>
      <p className="text-sm text-white/60 mt-1">
        Runtime overrides layered on top of env-driven defaults in{' '}
        <code className="text-white/80">src/lib/features.ts</code>. Cache TTL: 30 s.
      </p>

      {error && (
        <div className="mt-4 rounded border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="new-flag-key"
          className="rounded bg-white/5 border border-white/10 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            const k = newKey.trim();
            if (!k) return;
            void flip(k, false, null);
            setNewKey('');
          }}
          className="rounded bg-white/10 hover:bg-white/20 px-3 py-1.5 text-sm"
        >
          Add flag
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {flags.length === 0 && (
          <p className="text-sm text-white/50">No flags yet.</p>
        )}
        {flags.map((f) => (
          <FlagRow
            key={f.key}
            flag={f}
            pending={pending === f.key}
            onFlip={(enabled, value) => flip(f.key, enabled, value)}
          />
        ))}
      </div>
    </div>
  );
}

function FlagRow({
  flag,
  pending,
  onFlip,
}: {
  flag: Flag;
  pending: boolean;
  onFlip: (enabled: boolean, value: string | null) => void;
}) {
  const [valueText, setValueText] = useState(flag.value ?? '');
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-mono text-sm">{flag.key}</div>
          <div className="text-xs text-white/50">
            updated {new Date(flag.updatedAt).toLocaleString()}
            {flag.updatedBy ? ` by ${flag.updatedBy}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => onFlip(!flag.enabled, valueText || null)}
            className={`rounded px-3 py-1.5 text-sm ${
              flag.enabled
                ? 'bg-emerald-500/30 hover:bg-emerald-500/50'
                : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {flag.enabled ? 'enabled' : 'disabled'}
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs text-white/70"
          >
            {open ? 'hide audit' : 'show audit'}
          </button>
        </div>
      </div>
      <div className="mt-3">
        <label className="text-xs text-white/50">Value (JSON)</label>
        <textarea
          value={valueText}
          onChange={(e) => setValueText(e.target.value)}
          rows={2}
          spellCheck={false}
          className="mt-1 w-full rounded bg-black/40 border border-white/10 px-2 py-1 font-mono text-xs"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => onFlip(flag.enabled, valueText || null)}
          className="mt-1 rounded bg-white/10 hover:bg-white/20 px-3 py-1 text-xs"
        >
          Save value
        </button>
      </div>
      {open && (
        <ul className="mt-3 space-y-1 text-xs text-white/60">
          {flag.recentAudit.length === 0 && <li>No audit history.</li>}
          {flag.recentAudit.map((a) => (
            <li key={a.id} className="font-mono">
              {new Date(a.createdAt).toISOString()} · {a.enabled ? 'on' : 'off'} ·{' '}
              {a.updatedBy ?? '—'} {a.value ? `· ${a.value}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

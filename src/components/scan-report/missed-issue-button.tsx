'use client';

/**
 * Phase 3.7.1 — recall-side telemetry affordance.
 *
 * Two variants share the same dialog and POST handler:
 *  - <ScanLevelMissedButton scanId /> in the report header
 *  - <ModuleMissedLink scanId moduleId /> next to a category heading
 *
 * Both submit disposition=missed_other with a synthetic findingId of the form
 * missed:<scanId>:<moduleHint>:<uuid> (server-generated). The optional free-text
 * note stays in the UI; the schema has no note column and we explicitly chose
 * not to add one to keep the disposition table append-only and uniform.
 */

import { useState } from 'react';

const MODULE_HINT_OPTIONS = [
  'unknown',
  'P1-01',
  'P1-02',
  'P1-03',
  'P1-04',
  'P1-05',
  'P1-06',
  'P1-07',
  'P1-08',
  'P1-09',
  'P1-10',
  'P1-11',
  'P1-12',
  'P1-13',
  'P1-14',
  'P1-15',
];

interface DialogProps {
  scanId: string;
  source: 'scan' | 'module';
  fixedModule?: string;
  open: boolean;
  onClose: () => void;
}

function MissedDialog({ scanId, source, fixedModule, open, onClose }: DialogProps) {
  const [moduleHint, setModuleHint] = useState(fixedModule ?? 'unknown');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/internal/dispositions/missed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId, source, moduleHint }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text)',
          padding: 20,
          borderRadius: 12,
          width: 'min(440px, calc(100vw - 32px))',
          border: '1px solid var(--border)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Report a missed issue</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
          Tell us what we should have caught. This helps us measure recall, not just precision.
        </p>

        {done ? (
          <div style={{ marginTop: 12, fontSize: 13, color: '#10B981' }}>Thanks — logged.</div>
        ) : (
          <>
            <label style={{ display: 'block', marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
              Module hint
            </label>
            <select
              value={moduleHint}
              onChange={(e) => setModuleHint(e.target.value)}
              disabled={Boolean(fixedModule) || busy}
              style={{
                width: '100%',
                marginTop: 4,
                padding: '6px 8px',
                fontSize: 13,
                background: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 6,
              }}
            >
              {MODULE_HINT_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <label style={{ display: 'block', marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
              Note (optional, not saved server-side)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              disabled={busy}
              style={{
                width: '100%',
                marginTop: 4,
                padding: '6px 8px',
                fontSize: 13,
                background: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontFamily: 'inherit',
              }}
            />

            {error && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#EF4444' }}>{error}</div>
            )}
          </>
        )}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {done ? 'Close' : 'Cancel'}
          </button>
          {!done && (
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              style={{
                padding: '6px 12px',
                fontSize: 13,
                background: '#0F766E',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              {busy ? 'Submitting…' : 'Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ScanLevelMissedButton({ scanId, authed }: { scanId: string; authed: boolean }) {
  const [open, setOpen] = useState(false);
  if (!authed) {
    return (
      <span
        title="Sign in to flag"
        style={{ fontSize: 12, color: 'var(--text-tertiary)' }}
      >
        Sign in to flag a missed issue
      </span>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          fontSize: 12,
          padding: '4px 10px',
          background: 'transparent',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        Report a missed issue
      </button>
      <MissedDialog
        scanId={scanId}
        source="scan"
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function ModuleMissedLink({
  scanId,
  moduleId,
  authed,
}: {
  scanId: string;
  moduleId: string;
  authed: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!authed) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          fontSize: 11,
          padding: '2px 6px',
          background: 'transparent',
          color: 'var(--text-tertiary)',
          border: 'none',
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        we missed something here
      </button>
      <MissedDialog
        scanId={scanId}
        source="module"
        fixedModule={moduleId}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

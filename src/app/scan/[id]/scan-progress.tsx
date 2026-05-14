'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SCAN_MODULES } from '@/lib/data';
import { openScanStream } from '@/lib/api';

interface Props {
  scanId: string;
  scanUrl: string;
}

const STUCK_TIMEOUT_MS = 30_000;

// Per-module mock durations, summing to ~60 000 ms so the demo loader
// paces like a real scan instead of finishing in 5 s.
const MOCK_MODULE_DURATIONS_MS = [
  3500, 2800, 4200, 5500, 3000,
  4800, 3500, 2500, 5800, 4500,
  3800, 3000, 4500, 2200, 6400,
];

const SECURITY_FACTS = [
  '60% of small businesses fold within 6 months of a cyberattack — Verizon DBIR',
  'The average data breach costs $4.45M in 2024 — IBM Cost of a Data Breach Report',
  'AI-built sites often expose API keys in client bundles — a single grep can find them',
  'A misconfigured CORS header is the #2 source of cross-origin attacks',
  '43% of cyberattacks target small businesses, yet only 14% are prepared',
  'Stored XSS lets attackers hijack any logged-in session — including admins',
  'Open S3 buckets and Firebase rules expose 18B+ records every year',
  'A single leaked .env file can compromise an entire production stack',
  'Subdomain takeovers can be weaponized to phish users from "your" domain',
  '92% of malware is delivered via email — but web vulns are how it spreads inside',
];

const FACT_ROTATE_MS = 4500;
const ESTIMATED_TOTAL_S = 60;

export function ScanProgress({ scanId, scanUrl }: Props) {
  const router = useRouter();
  const [completedModules, setCompletedModules] = useState(0);
  const [activeModule, setActiveModule] = useState(0);
  const [moduleResults, setModuleResults] = useState<Record<string, number>>({});
  const [elapsed, setElapsed] = useState(0);
  const [factIdx, setFactIdx] = useState(0);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [scanFailed, setScanFailed] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [usingRealStream, setUsingRealStream] = useState(false);
  const streamRef = useRef<EventSource | null>(null);
  const lastEventRef = useRef<number>(Date.now());

  const total = SCAN_MODULES.length;
  const etaSeconds = Math.max(0, ESTIMATED_TOTAL_S - elapsed);
  const finalizing =
    completedModules >= total && !scanCompleted && !scanFailed;
  const etaOverrun =
    usingRealStream && elapsed > ESTIMATED_TOTAL_S && !scanCompleted && !scanFailed;

  const retryNavigateHome = useCallback(() => {
    router.push('/');
  }, [router]);

  // Elapsed timer — runs until scan terminates (complete or failed).
  useEffect(() => {
    if (scanCompleted || scanFailed) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [scanCompleted, scanFailed]);

  // Stuck detector — only meaningful for real SSE; the mock path's own ticks
  // also reset lastEventRef, but we gate the UI banner behind `usingRealStream`
  // so the demo route never shows it spuriously.
  useEffect(() => {
    if (scanCompleted || scanFailed) return;
    const t = setInterval(() => {
      if (Date.now() - lastEventRef.current > STUCK_TIMEOUT_MS) {
        setStuck(true);
      }
    }, 2000);
    return () => clearInterval(t);
  }, [scanCompleted, scanFailed]);

  useEffect(() => {
    const t = setInterval(() => {
      setFactIdx((i) => (i + 1) % SECURITY_FACTS.length);
    }, FACT_ROTATE_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const stream = openScanStream(scanId);

    if (stream) {
      streamRef.current = stream;
      setUsingRealStream(true);

      const markEvent = () => {
        lastEventRef.current = Date.now();
        setStuck(false);
      };

      stream.addEventListener('module_complete', (e: MessageEvent) => {
        markEvent();
        const data = JSON.parse(e.data) as { module_id: string; findings: number; index: number };
        setModuleResults((prev) => ({ ...prev, [data.module_id]: data.findings }));
        setCompletedModules(data.index + 1);
        setActiveModule(data.index + 1);
      });

      stream.addEventListener('llm_enrichment_started', markEvent);
      stream.addEventListener('llm_enrichment_complete', markEvent);

      stream.addEventListener('scan_complete', () => {
        markEvent();
        setScanCompleted(true);
        stream.close();
        setTimeout(() => router.push(`/report/${scanId}`), 1200);
      });

      stream.addEventListener('scan_failed', () => {
        setScanFailed(true);
        stream.close();
      });

      stream.addEventListener('scan_timeout', () => {
        setScanFailed(true);
        stream.close();
      });

      return () => stream.close();
    }

    const BAD_RESULTS: Record<string, number> = {
      'P1-01': 1, 'P1-02': 1, 'P1-03': 2, 'P1-04': 0,
      'P1-05': 1, 'P1-06': 1, 'P1-07': 1, 'P1-08': 1,
      'P1-09': 1, 'P1-10': 0, 'P1-11': 0, 'P1-12': 0,
      'P1-13': 1, 'P1-14': 1, 'P1-15': 0,
    };

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tick = (idx: number) => {
      if (cancelled) return;
      lastEventRef.current = Date.now();
      const mod = SCAN_MODULES[idx];
      if (mod) {
        setModuleResults((prev) => ({ ...prev, [mod.id]: BAD_RESULTS[mod.id] ?? 0 }));
      }
      const nextIdx = idx + 1;
      setActiveModule(nextIdx);
      setCompletedModules(nextIdx);
      if (nextIdx >= total) {
        timeoutId = setTimeout(() => {
          if (!cancelled) router.push(`/report/${scanId}?url=${encodeURIComponent(scanUrl)}`);
        }, 1200);
        return;
      }
      const delay = MOCK_MODULE_DURATIONS_MS[nextIdx] ?? 4000;
      timeoutId = setTimeout(() => tick(nextIdx), delay);
    };

    timeoutId = setTimeout(() => tick(0), MOCK_MODULE_DURATIONS_MS[0] ?? 4000);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [scanId, scanUrl, router, total]);

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 'clamp(24px, 5vw, 24px)', paddingTop: 'clamp(32px, 8vh, 80px)', paddingBottom: 'clamp(32px, 8vh, 80px)' }}>
      <div
        className="screen-enter"
        style={{
          background: 'var(--surface)',
          borderRadius: 16,
          border: '1px solid var(--border)',
          padding: 'clamp(24px, 5vw, 40px)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {scanFailed && <ScanFailedCard scanId={scanId} onRetry={retryNavigateHome} />}

        {!scanFailed && (
          <div
            aria-hidden="true"
            style={{
              width: 64,
              height: 64,
              border: '4px solid var(--border)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 24px',
            }}
          />
        )}

        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text)', wordBreak: 'break-word' }}>
          Scanning {scanUrl}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32 }}>
          Running {total} security, performance, and accessibility checks...
        </div>

        <aside
          aria-label="Did you know?"
          style={{
            background: 'var(--surface-secondary)',
            borderLeft: '3px solid var(--accent)',
            padding: '16px 20px',
            borderRadius: 8,
            margin: '24px 0',
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--accent)',
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            💡 Did you know?
          </div>
          <div key={factIdx} className="fact-fade">
            {SECURITY_FACTS[factIdx]}
          </div>
        </aside>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
          {SCAN_MODULES.map((mod, i) => {
            const isDone = i < completedModules;
            const isActive = i === activeModule && !isDone && i < total;
            const findCount = moduleResults[mod.id] ?? 0;

            const statusBg = isDone
              ? '#059669'
              : isActive
              ? 'var(--accent)'
              : 'var(--border)';
            const statusColor = isDone || isActive ? '#fff' : 'var(--text-tertiary)';
            const statusSymbol = isDone ? '✓' : isActive ? '⏳' : '○';

            return (
              <div
                key={mod.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: 'var(--bg)',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    background: statusBg,
                    color: statusColor,
                    flexShrink: 0,
                    animation: isActive ? 'pulse-soft 2s ease-in-out infinite' : undefined,
                  }}
                >
                  {statusSymbol}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--text)', wordBreak: 'break-word' }}>
                    {mod.plainName}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-tertiary)',
                      marginTop: 2,
                      wordBreak: 'break-word',
                    }}
                  >
                    {mod.name}
                  </div>
                </div>
                {isDone && findCount > 0 && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--accent)',
                      padding: '1px 8px',
                      borderRadius: 10,
                      background: 'var(--accent-light)',
                    }}
                  >
                    {findCount} found
                  </span>
                )}
                {isDone && findCount === 0 && (
                  <span style={{ fontSize: 12, color: '#059669', fontWeight: 500 }}>Clear</span>
                )}
              </div>
            );
          })}
        </div>

        <p
          aria-live="polite"
          style={{
            fontSize: 13,
            color: 'var(--text-tertiary)',
            marginTop: 24,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {scanFailed ? (
            'Scan failed.'
          ) : scanCompleted ? (
            'Analysis complete — opening report…'
          ) : finalizing ? (
            'Finalising report…'
          ) : (
            <>
              Estimated time remaining: <span>{etaSeconds}</span> seconds
            </>
          )}
        </p>

        {!scanFailed && etaOverrun && !stuck && (
          <StatusBanner
            tone="info"
            title="Taking longer than usual"
            body="Your scan is still running. LLM enrichment or a slow target can push past the ETA — we'll redirect when it finishes."
          />
        )}

        {!scanFailed && stuck && usingRealStream && (
          <StatusBanner
            tone="warn"
            title="Still working…"
            body="We haven't heard from the scanner in 30 seconds. The connection may have dropped, or the scanner may have stalled."
            action={{ label: 'Start a new scan', onClick: retryNavigateHome }}
          />
        )}
      </div>
    </div>
  );
}

function ScanFailedCard({ scanId, onRetry }: { scanId: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      style={{
        background: 'rgba(220,38,38,0.08)',
        border: '1px solid rgba(220,38,38,0.30)',
        borderRadius: 12,
        padding: '20px 22px',
        marginBottom: 24,
        textAlign: 'left',
      }}
    >
      <strong style={{ color: '#DC2626', display: 'block', marginBottom: 6, fontSize: 15 }}>
        Scan failed
      </strong>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.6 }}>
        Something went wrong on our end and the scan didn&apos;t finish. Try again — or share the scan ID
        with support if it keeps failing.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={onRetry}
          className="btn-primary"
          style={{ padding: '8px 16px', fontSize: 13, minHeight: 0 }}
        >
          Start a new scan
        </button>
        <Link
          href="/dashboard"
          className="btn-secondary"
          style={{ padding: '8px 16px', fontSize: 13, minHeight: 0 }}
        >
          Back to dashboard
        </Link>
        <code
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--text-tertiary)',
            wordBreak: 'break-all',
          }}
        >
          {scanId}
        </code>
      </div>
    </div>
  );
}

function StatusBanner({
  tone,
  title,
  body,
  action,
}: {
  tone: 'info' | 'warn';
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  const palette =
    tone === 'warn'
      ? { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.35)', fg: '#B45309' }
      : { bg: 'rgba(13,148,136,0.08)', border: 'rgba(13,148,136,0.30)', fg: 'var(--accent)' };
  return (
    <div
      role={tone === 'warn' ? 'alert' : 'status'}
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 10,
        padding: '12px 14px',
        marginTop: 16,
        textAlign: 'left',
      }}
    >
      <strong style={{ color: palette.fg, display: 'block', marginBottom: 4, fontSize: 13 }}>
        {title}
      </strong>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
        {body}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            marginTop: 10,
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 600,
            color: palette.fg,
            background: 'transparent',
            border: `1px solid ${palette.border}`,
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SCAN_MODULES } from '@/lib/data';
import { fetchScanEvents } from '@/lib/api';

interface Props {
  scanId: string;
  scanUrl: string;
  initialVariant: 'A' | 'C';
}

type Variant = 'A' | 'C';

const LAST_VARIANT_KEY = 'sentry:lastScanVariant';
const STUCK_TIMEOUT_MS = 30_000;

// Per-module mock durations, summing to ~60 000 ms so the demo loader
// paces like a real scan instead of finishing in 5 s.
const MOCK_MODULE_DURATIONS_MS = [
  3500, 2800, 4200, 5500, 3000,
  4800, 3500, 2500, 5800, 4500,
  3800, 3000, 4500, 2200, 6400,
];

const SECURITY_FACT_COUNT = 10;

const FACT_ROTATE_MS = 4500;
const ESTIMATED_TOTAL_S = 60;

// Code snippets used by the drifting background + laptop screen.
const CODE_SNIPPETS = [
  "const token = req.headers.authorization;",
  "SELECT * FROM users WHERE role='admin' --",
  "curl -sX POST https://target/api/scan",
  "if (key.startsWith('sk_live_')) leak();",
  "<script>fetch('/admin').then(r=>r.text())</script>",
  "eval(atob(payload));",
  "Set-Cookie: session=abc; HttpOnly; Secure",
  "Strict-Transport-Security: max-age=31536000",
  "Access-Control-Allow-Origin: *",
  "TLSv1.3 / cipher=TLS_AES_256_GCM_SHA384",
  "Authorization: Bearer eyJhbGciOiJIUzI1NiI...",
  "rm -rf /var/www/.env.production",
  "0xDEADBEEF / 0xCAFEBABE",
  "Content-Security-Policy: default-src 'self'",
  "function bypassAuth(u){return u.role||'admin'}",
  "POST /api/v1/login {user, pw}",
  "git log --all -p | grep -i secret",
  "ssh root@10.0.0.42 -i ~/.ssh/id_rsa",
];

// Per-module log snippets used in the active card / packets.
const MODULE_LOG_LINES: Record<string, string[]> = {
  'P1-01': ['scanning JS bundles…', 'grep -E "sk_(live|test)_"', 'parsing source maps…'],
  'P1-02': ['probing /static/**/*.map', 'reading webpack chunks…', 'checking sourceMappingURL'],
  'P1-03': ['HEAD /', 'parsing CSP directives…', 'X-Frame-Options check'],
  'P1-04': ['openssl s_client -connect…', 'TLS handshake…', 'cipher suite probe'],
  'P1-05': ['scanning Set-Cookie headers', 'HttpOnly / SameSite audit', 'localStorage probe'],
  'P1-06': ['fuzzing /admin /backup /.git', 'wordlist: common.txt', '404 vs 403 analysis'],
  'P1-07': ['OPTIONS preflight', 'origin reflection check', 'wildcard ACAO test'],
  'P1-08': ['parsing HTML for http:// refs', 'subresource integrity audit', 'mixed-content tally'],
  'P1-09': ['enumerating <script src>', 'CDN reputation lookup', 'integrity hash check'],
  'P1-10': ['dig +short MX', 'SPF / DKIM / DMARC parse', 'DNSSEC validation'],
  'P1-11': ['enumerating CNAME chain', 'checking dangling AWS / GH', 'subdomain takeover test'],
  'P1-12': ['triggering 500 errors', 'parsing stack traces', 'framework fingerprint'],
  'P1-13': ['probing /wp-admin /phpmyadmin', '/_next/static check', 'auth wall detection'],
  'P1-14': ['GET /robots.txt', 'GET /sitemap.xml', 'parsing disallow rules'],
  'P1-15': ['inspecting Cache-Control', 'private vs public audit', 'CDN edge probe'],
};

const DEFAULT_LOG_LINES = ['probing…', 'parsing response…', 'normalising findings…'];

type ViewProps = {
  scanId: string;
  scanUrl: string;
  total: number;
  completedModules: number;
  activeModule: number;
  moduleResults: Record<string, number>;
  elapsed: number;
  etaSeconds: number;
  factIdx: number;
  scanCompleted: boolean;
  scanFailed: boolean;
  stuck: boolean;
  usingRealStream: boolean;
  finalizing: boolean;
  etaOverrun: boolean;
  retryNavigateHome: () => void;
};

export function ScanProgress({ scanId, scanUrl, initialVariant }: Props) {
  const router = useRouter();
  const variant: Variant = initialVariant;
  const [completedModules, setCompletedModules] = useState(0);
  const [activeModule, setActiveModule] = useState(0);
  const [moduleResults, setModuleResults] = useState<Record<string, number>>({});
  const [elapsed, setElapsed] = useState(0);
  const [factIdx, setFactIdx] = useState(0);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [scanFailed, setScanFailed] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [usingRealStream, setUsingRealStream] = useState(false);
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

  // Persist the variant the server picked so the *next* scan can pick
  // the opposite (round-robin across A ↔ C). Cookie powers the server-side
  // pick; localStorage is kept in sync as a backup signal.
  useEffect(() => {
    try { localStorage.setItem(LAST_VARIANT_KEY, variant); } catch {}
    try {
      document.cookie = `${LAST_VARIANT_KEY}=${variant}; path=/; max-age=${60 * 60 * 24 * 90}; SameSite=Lax`;
    } catch {}
  }, [variant]);

  useEffect(() => {
    if (scanCompleted || scanFailed) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [scanCompleted, scanFailed]);

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
      setFactIdx((i) => (i + 1) % SECURITY_FACT_COUNT);
    }, FACT_ROTATE_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (scanId !== 'demo') {
      setUsingRealStream(true);

      let cursor = 0;
      let cancelled = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const markEvent = () => {
        lastEventRef.current = Date.now();
        setStuck(false);
      };

      const completeAndRedirect = () => {
        setScanCompleted(true);
        setTimeout(() => {
          if (!cancelled) router.push(`/report/${scanId}`);
        }, 1200);
      };

      // Returns true if a terminal event was handled and polling should stop.
      const dispatch = (type: string, payload: Record<string, unknown>): boolean => {
        switch (type) {
          case 'module_complete': {
            markEvent();
            const d = payload as { module_id: string; findings: number; index: number };
            setModuleResults((prev) => ({ ...prev, [d.module_id]: d.findings }));
            setCompletedModules(d.index + 1);
            setActiveModule(d.index + 1);
            return false;
          }
          case 'llm_enrichment_started':
          case 'llm_enrichment_complete':
            markEvent();
            return false;
          case 'scan_complete':
            markEvent();
            completeAndRedirect();
            return true;
          case 'scan_failed':
          case 'scan_timeout':
            setScanFailed(true);
            return true;
          default:
            return false;
        }
      };

      const poll = async () => {
        if (cancelled) return;
        try {
          const res = await fetchScanEvents(scanId, cursor);
          if (cancelled) return;
          cursor = res.cursor;

          let terminal = false;
          for (const ev of res.events) {
            if (dispatch(ev.type, ev.payload)) {
              terminal = true;
              break;
            }
          }

          // Fallback: terminal scan status but no terminal event recorded
          // (e.g. worker died before publishing). Drive the UI off of `scan.status`.
          if (!terminal) {
            if (res.scan.status === 'COMPLETED') {
              completeAndRedirect();
              terminal = true;
            } else if (res.scan.status === 'FAILED' || res.scan.status === 'TIMEOUT') {
              setScanFailed(true);
              terminal = true;
            }
          }

          if (!terminal && !cancelled) {
            timeoutId = setTimeout(poll, 1500);
          }
        } catch {
          if (!cancelled) {
            timeoutId = setTimeout(poll, 3000);
          }
        }
      };

      poll();

      return () => {
        cancelled = true;
        if (timeoutId) clearTimeout(timeoutId);
      };
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

  const view: ViewProps = {
    scanId, scanUrl, total, completedModules, activeModule, moduleResults,
    elapsed, etaSeconds, factIdx, scanCompleted, scanFailed, stuck,
    usingRealStream, finalizing, etaOverrun, retryNavigateHome,
  };

  return (
    <>
      {variant === 'A' && <ScanProgressStash {...view} />}
      {variant === 'C' && <ScanProgressHacker {...view} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Drifting code background (used by Variant A + C)
// ─────────────────────────────────────────────────────────────
function CodeDriftBackground({ density = 14 }: { density?: number }) {
  const lines = useMemo(() => {
    return Array.from({ length: density }).map((_, i) => {
      const snippet = CODE_SNIPPETS[i % CODE_SNIPPETS.length];
      const top = (i * 53) % 90 + 2;
      const duration = 22 + ((i * 7) % 22);
      const delay = -((i * 3) % duration);
      const fontSize = 12 + ((i * 5) % 6);
      return { snippet, top, duration, delay, fontSize, key: i };
    });
  }, [density]);
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        zIndex: 0,
        pointerEvents: 'none',
        background:
          'radial-gradient(circle at 50% 40%, rgba(13,148,136,0.06) 0%, transparent 55%), linear-gradient(180deg, #060a10 0%, #0b1220 100%)',
      }}
    >
      {lines.map((l) => (
        <div
          key={l.key}
          className="code-drift-line"
          style={{
            position: 'absolute',
            top: `${l.top}%`,
            left: 0,
            whiteSpace: 'nowrap',
            fontFamily: 'var(--mono)',
            fontSize: l.fontSize,
            color: 'rgba(94, 234, 212, 0.10)',
            animation: `code-drift ${l.duration}s linear infinite`,
            animationDelay: `${l.delay}s`,
          }}
        >
          {l.snippet}
        </div>
      ))}
      {/* faint grid overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse at center, #000 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, #000 30%, transparent 80%)',
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Variant A — Center → Stash
// ─────────────────────────────────────────────────────────────
function ScanProgressStash(p: ViewProps) {
  const t = useTranslations('scan');
  const activeMod = SCAN_MODULES[Math.min(p.activeModule, p.total - 1)];
  const activeLogs = useRollingLogs(activeMod?.id);
  const [flying, setFlying] = useState<{ id: string; key: number } | null>(null);
  const completedRef = useRef(0);

  useEffect(() => {
    if (p.completedModules > completedRef.current) {
      const idx = completedRef.current;
      const mod = SCAN_MODULES[idx];
      completedRef.current = p.completedModules;
      if (mod) {
        setFlying({ id: mod.id, key: Date.now() });
        const t = setTimeout(() => setFlying(null), 520);
        return () => clearTimeout(t);
      }
    }
  }, [p.completedModules]);

  const progressPct = Math.round((p.completedModules / p.total) * 100);

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      <CodeDriftBackground density={16} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 880, margin: '0 auto', padding: 'clamp(24px, 5vw, 40px)' }}>
        {/* Top progress strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 28,
            fontFamily: 'var(--mono)',
            fontSize: 12,
            color: '#A1A1AA',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ wordBreak: 'break-all' }}>
            <span style={{ color: '#5EEAD4' }}>{t('labels.target')}</span> ::{' '}
            <span style={{ color: '#fff' }}>{p.scanUrl}</span>
          </div>
          <div style={{ display: 'flex', gap: 18, fontVariantNumeric: 'tabular-nums' }}>
            <span>{t('labels.elapsed')} <span style={{ color: '#fff' }}>{fmtTime(p.elapsed)}</span></span>
            <span>{t('labels.eta')} <span style={{ color: '#fff' }}>{fmtTime(p.etaSeconds)}</span></span>
            <span>{progressPct}%</span>
          </div>
        </div>
        <div
          aria-label="progress"
          style={{
            height: 4,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 999,
            overflow: 'hidden',
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #14b8a6, #5eead4)',
              boxShadow: '0 0 18px rgba(94,234,212,0.55)',
              transition: 'width 0.6s ease',
            }}
          />
        </div>

        {p.scanFailed ? (
          <ScanFailedCard scanId={p.scanId} onRetry={p.retryNavigateHome} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
            {/* Active center card */}
            {activeMod && p.activeModule < p.total && (
              <div
                key={p.activeModule}
                style={{
                  position: 'relative',
                  width: 'min(520px, 100%)',
                  padding: '28px 32px 24px',
                  background: 'rgba(10, 18, 22, 0.85)',
                  border: '1px solid rgba(94,234,212,0.35)',
                  borderRadius: 16,
                  boxShadow: '0 0 40px rgba(13,148,136,0.25), inset 0 0 60px rgba(13,148,136,0.05)',
                  animation: 'deal-in 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) both',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    color: '#5EEAD4',
                    letterSpacing: '1px',
                    marginBottom: 10,
                  }}
                >
                  {t('labels.moduleStatus', {
                    current: String(p.activeModule + 1).padStart(2, '0'),
                    total: p.total,
                  })}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                  {activeMod.plainName}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 12,
                    color: '#71717A',
                    marginBottom: 18,
                  }}
                >
                  &gt; {activeMod.name}
                </div>
                {/* Shimmer bar */}
                <div
                  style={{
                    position: 'relative',
                    height: 6,
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 999,
                    overflow: 'hidden',
                    marginBottom: 16,
                  }}
                >
                  <div
                    className="shimmer-bar"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '40%',
                      background:
                        'linear-gradient(90deg, transparent, #5EEAD4, transparent)',
                      animation: 'shimmer-bar 1.6s linear infinite',
                    }}
                  />
                </div>
                {/* Rolling log lines */}
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 12,
                    color: '#94a3b8',
                    minHeight: 60,
                    lineHeight: 1.7,
                  }}
                >
                  {activeLogs.map((line, i) => (
                    <div
                      key={`${activeMod.id}-${line}-${i}`}
                      style={{ opacity: i === activeLogs.length - 1 ? 1 : 0.5 }}
                    >
                      <span style={{ color: '#5EEAD4' }}>$</span> {line}
                      {i === activeLogs.length - 1 && (
                        <span className="terminal-caret" style={{ color: '#5EEAD4' }}>▍</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Flying card (deal-to-stash) */}
            {flying && (
              <div
                key={flying.key}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 140,
                  left: '50%',
                  marginLeft: -200,
                  width: 400,
                  padding: '20px 24px',
                  background: 'rgba(10, 18, 22, 0.9)',
                  border: '1px solid rgba(94,234,212,0.5)',
                  borderRadius: 14,
                  fontFamily: 'var(--mono)',
                  fontSize: 13,
                  color: '#5EEAD4',
                  pointerEvents: 'none',
                  animation: 'deal-to-stash 0.5s cubic-bezier(0.4, 0, 0.6, 1) both',
                  // @ts-expect-error custom property
                  '--fly-end': 'translate(0, 320px) scale(0.4) rotate(-4deg)',
                }}
              >
                ✓ {SCAN_MODULES.find((m) => m.id === flying.id)?.plainName}
              </div>
            )}

            {/* Stash pile */}
            <div style={{ width: '100%', maxWidth: 720 }}>
              <div
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  color: '#5EEAD4',
                  letterSpacing: '1.5px',
                  marginBottom: 12,
                }}
              >
                {t('labels.stash')} · {p.completedModules}/{p.total}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 8,
                }}
              >
                {SCAN_MODULES.map((mod, i) => {
                  const done = i < p.completedModules;
                  if (!done) return null;
                  const finds = p.moduleResults[mod.id] ?? 0;
                  const rot = (i % 2 === 0 ? -1 : 1) * (((i % 3) + 1) * 0.6);
                  return (
                    <div
                      key={mod.id}
                      style={{
                        background: 'rgba(15, 23, 28, 0.85)',
                        border: '1px solid rgba(94,234,212,0.2)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transform: `rotate(${rot}deg)`,
                        animation: 'deal-in 0.4s ease-out both',
                        animationDelay: `${Math.max(0, i - p.completedModules + 6) * 0.04}s`,
                      }}
                    >
                      <span
                        style={{
                          color: finds > 0 ? '#fb7185' : '#34d399',
                          fontFamily: 'var(--mono)',
                          fontSize: 14,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {finds > 0 ? '⚠' : '✓'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            color: '#e5e7eb',
                            fontSize: 12,
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={mod.plainName}
                        >
                          {mod.plainName}
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 10,
                            color: finds > 0 ? '#fb7185' : '#6b7280',
                          }}
                        >
                          {finds > 0 ? t('labels.found', { count: finds }) : t('labels.clean')}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {p.completedModules === 0 && (
                  <div
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 12,
                      color: '#52525b',
                      gridColumn: '1 / -1',
                    }}
                  >
                    {t('labels.stashEmpty')}
                  </div>
                )}
              </div>
            </div>

            {/* Did you know */}
            <DidYouKnow factIdx={p.factIdx} variant="A" />

            <StatusFooter {...p} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Variant C — Hacker at Laptop + Code Streams
// ─────────────────────────────────────────────────────────────
function ScanProgressHacker(p: ViewProps) {
  const t = useTranslations('scan');
  const [packets, setPackets] = useState<Array<{ key: number; targetIdx: number }>>([]);
  const completedRef = useRef(0);

  useEffect(() => {
    if (p.completedModules > completedRef.current) {
      const idx = completedRef.current;
      completedRef.current = p.completedModules;
      const key = Date.now() + idx;
      setPackets((ps) => [...ps, { key, targetIdx: idx }]);
      const t = setTimeout(() => {
        setPackets((ps) => ps.filter((q) => q.key !== key));
      }, 700);
      return () => clearTimeout(t);
    }
  }, [p.completedModules]);

  const progressPct = Math.round((p.completedModules / p.total) * 100);
  const circumference = 2 * Math.PI * 52;
  const dashOffset = circumference * (1 - p.completedModules / p.total);

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      <CodeDriftBackground density={18} />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1080,
          margin: '0 auto',
          padding: 'clamp(20px, 4vw, 32px)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 360px) minmax(0, 1fr)',
          gap: 'clamp(16px, 3vw, 36px)',
          alignItems: 'start',
        }}
        className="hacker-grid"
      >
        {/* Left: hacker + progress ring */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <HackerSvg activeModule={p.activeModule} />

          {/* Progress ring */}
          <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
            <circle cx="70" cy="70" r="52" stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="none" />
            <circle
              cx="70"
              cy="70"
              r="52"
              stroke="#5EEAD4"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 70 70)"
              style={{
                transition: 'stroke-dashoffset 0.6s ease',
                filter: 'drop-shadow(0 0 8px rgba(94,234,212,0.6))',
              }}
            />
            <text
              x="70"
              y="68"
              textAnchor="middle"
              fill="#fff"
              fontSize="28"
              fontWeight="700"
              fontFamily="ui-monospace, Menlo, monospace"
            >
              {progressPct}%
            </text>
            <text
              x="70"
              y="92"
              textAnchor="middle"
              fill="#5EEAD4"
              fontSize="10"
              fontFamily="ui-monospace, Menlo, monospace"
              letterSpacing="1.5"
            >
              {String(Math.min(p.activeModule + 1, p.total)).padStart(2, '0')} / {p.total}
            </text>
          </svg>

          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: '#94a3b8',
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            <div>
              <span style={{ color: '#5EEAD4' }}>{t('labels.target')}</span>{' '}
              <span style={{ color: '#fff', wordBreak: 'break-all' }}>{p.scanUrl}</span>
            </div>
            <div style={{ marginTop: 4 }}>
              {t('labels.elapsed')} <span style={{ color: '#fff' }}>{fmtTime(p.elapsed)}</span> · {t('labels.eta')}{' '}
              <span style={{ color: '#fff' }}>{fmtTime(p.etaSeconds)}</span>
            </div>
          </div>

          <DidYouKnow factIdx={p.factIdx} variant="C" />
        </div>

        {/* Right: module list */}
        <div style={{ position: 'relative' }}>
          {p.scanFailed ? (
            <ScanFailedCard scanId={p.scanId} onRetry={p.retryNavigateHome} variant="hacker" />
          ) : (
            <div
              style={{
                background: 'rgba(10, 18, 22, 0.72)',
                backdropFilter: 'blur(6px)',
                border: '1px solid rgba(94,234,212,0.18)',
                borderRadius: 14,
                padding: 18,
                boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  color: '#5EEAD4',
                  letterSpacing: '1.5px',
                  marginBottom: 12,
                }}
              >
                {t('labels.attackChain', { total: p.total })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SCAN_MODULES.map((mod, i) => {
                  const done = i < p.completedModules;
                  const active = i === p.activeModule && !done && i < p.total;
                  const finds = p.moduleResults[mod.id] ?? 0;
                  return (
                    <div
                      key={mod.id}
                      data-row-idx={i}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: active
                          ? 'rgba(94,234,212,0.08)'
                          : 'rgba(255,255,255,0.025)',
                        border: active
                          ? '1px solid rgba(94,234,212,0.45)'
                          : '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 0.3s ease, border-color 0.3s ease',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            color: done || active ? '#fff' : '#71717A',
                            fontSize: 13,
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {mod.plainName}
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 10,
                            color: '#52525b',
                          }}
                        >
                          {mod.name}
                        </div>
                      </div>
                      <StatusPill done={done} active={active} findings={finds} />
                      {/* Code packet flying in when this row was just completed */}
                      {packets.some((q) => q.targetIdx === i) && (
                        <span
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            left: -40,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontFamily: 'var(--mono)',
                            fontSize: 11,
                            color: '#5EEAD4',
                            textShadow: '0 0 10px rgba(94,234,212,0.85)',
                            animation: 'packet-fly 0.65s cubic-bezier(0.5, 0, 0.6, 1) both',
                            // @ts-expect-error custom prop
                            '--packet-end': 'translate(120%, -50%) scale(0.6)',
                          }}
                        >
                          0x{(i * 31 + 7).toString(16).toUpperCase().padStart(2, '0')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <StatusFooter {...p} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ done, active, findings }: { done: boolean; active: boolean; findings: number }) {
  const t = useTranslations('scan.pill');
  if (done) {
    const clean = findings === 0;
    return (
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.8px',
          padding: '3px 8px',
          borderRadius: 999,
          background: clean ? 'rgba(34,197,94,0.12)' : 'rgba(251,113,133,0.12)',
          color: clean ? '#4ade80' : '#fb7185',
          border: `1px solid ${clean ? 'rgba(34,197,94,0.35)' : 'rgba(251,113,133,0.35)'}`,
          whiteSpace: 'nowrap',
        }}
      >
        {clean ? t('clean') : t('owned', { count: findings })}
      </span>
    );
  }
  if (active) {
    return (
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.8px',
          padding: '3px 8px',
          borderRadius: 999,
          background: 'rgba(94,234,212,0.12)',
          color: '#5EEAD4',
          border: '1px solid rgba(94,234,212,0.45)',
          whiteSpace: 'nowrap',
        }}
      >
        [{t('breaching')}<span className="dot-1">.</span><span className="dot-2">.</span><span className="dot-3">.</span>]
      </span>
    );
  }
  return (
    <span
      style={{
        fontFamily: 'var(--mono)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.8px',
        padding: '3px 8px',
        borderRadius: 999,
        color: '#52525b',
        border: '1px solid rgba(255,255,255,0.06)',
        whiteSpace: 'nowrap',
      }}
    >
      {t('queued')}
    </span>
  );
}

function HackerSvg({ activeModule }: { activeModule: number }) {
  // Re-key the screen text so the laptop "scrolls" between modules.
  return (
    <div
      style={{
        position: 'relative',
        width: 240,
        height: 180,
        filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.4))',
      }}
    >
      <svg viewBox="0 0 240 180" width="240" height="180" aria-hidden="true">
        <defs>
          <linearGradient id="screen" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#042f2e" />
          </linearGradient>
          <linearGradient id="hood" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#1f2937" />
            <stop offset="100%" stopColor="#0b1220" />
          </linearGradient>
          <clipPath id="screenClip">
            <rect x="64" y="62" width="112" height="62" rx="2" />
          </clipPath>
        </defs>
        {/* Desk */}
        <rect x="20" y="135" width="200" height="6" rx="2" fill="rgba(255,255,255,0.06)" />
        {/* Laptop base */}
        <rect x="55" y="125" width="130" height="14" rx="3" fill="#1f2937" stroke="#0b1220" strokeWidth="1" />
        {/* Laptop lid */}
        <rect x="60" y="58" width="120" height="70" rx="4" fill="#0b1220" stroke="#1f2937" strokeWidth="2" />
        {/* Screen content */}
        <g clipPath="url(#screenClip)">
          <rect x="64" y="62" width="112" height="62" fill="url(#screen)" />
          <text x="68" y="74" fill="#5EEAD4" fontSize="6" fontFamily="ui-monospace, Menlo, monospace" opacity="0.9">
            $ exploit --target
          </text>
          <text x="68" y="84" fill="#bbf7d0" fontSize="6" fontFamily="ui-monospace, Menlo, monospace" opacity="0.85">
            {'> probing...'}
          </text>
          <text x="68" y="94" fill="#5EEAD4" fontSize="6" fontFamily="ui-monospace, Menlo, monospace" opacity="0.9">
            mod_{String((activeModule % 15) + 1).padStart(2, '0')}: OK
          </text>
          <text x="68" y="104" fill="#bbf7d0" fontSize="6" fontFamily="ui-monospace, Menlo, monospace" opacity="0.7">
            0x{(activeModule * 31).toString(16).toUpperCase()}
          </text>
          <text x="68" y="114" fill="#5EEAD4" fontSize="6" fontFamily="ui-monospace, Menlo, monospace" opacity="0.6">
            {'> next module...'}
          </text>
        </g>
        {/* Glow */}
        <rect x="60" y="58" width="120" height="70" rx="4" fill="none" stroke="#5EEAD4" strokeWidth="1" opacity="0.4" />

        {/* Hacker body */}
        <ellipse cx="120" cy="180" rx="60" ry="10" fill="rgba(0,0,0,0.5)" />
        {/* Hood / head */}
        <path
          d="M 90 60 Q 95 30 120 28 Q 145 30 150 60 L 152 95 Q 145 105 120 105 Q 95 105 88 95 Z"
          fill="url(#hood)"
          stroke="rgba(94,234,212,0.35)"
          strokeWidth="1"
          style={{ animation: 'pulse-glow 3s ease-in-out infinite' }}
        />
        {/* Face shadow */}
        <ellipse cx="120" cy="65" rx="18" ry="14" fill="#000" opacity="0.85" />
        {/* Two glowing eyes */}
        <circle cx="113" cy="63" r="1.8" fill="#5EEAD4">
          <animate attributeName="opacity" values="1;0.4;1" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx="127" cy="63" r="1.8" fill="#5EEAD4">
          <animate attributeName="opacity" values="1;0.4;1" dur="2.4s" repeatCount="indefinite" />
        </circle>
        {/* Arms / hands typing */}
        <g
          className="typing-arm"
          style={{
            transformOrigin: '120px 110px',
            animation: 'type-frame 0.32s steps(2, end) infinite',
          }}
        >
          <rect x="92" y="105" width="22" height="6" rx="3" fill="#1f2937" />
          <rect x="126" y="105" width="22" height="6" rx="3" fill="#1f2937" />
          <circle cx="92" cy="118" r="4" fill="#1f2937" />
          <circle cx="148" cy="118" r="4" fill="#1f2937" />
        </g>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────
function DidYouKnow({ factIdx, variant }: { factIdx: number; variant: Variant }) {
  const t = useTranslations('scan');
  const facts = t.raw('facts') as string[];
  const safeIdx = facts.length > 0 ? factIdx % facts.length : 0;
  const fact = facts[safeIdx] ?? '';
  if (variant === 'A') {
    return (
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          padding: '12px 16px',
          fontFamily: 'var(--mono)',
          fontSize: 12,
          color: '#94a3b8',
          borderLeft: '2px solid rgba(94,234,212,0.5)',
          background: 'rgba(94,234,212,0.04)',
          borderRadius: '0 8px 8px 0',
        }}
      >
        <span style={{ color: '#5EEAD4' }}>{t('labels.intel')}</span>{' '}
        <span key={factIdx} className="fact-fade">
          {fact}
        </span>
      </div>
    );
  }
  return (
    <div
      style={{
        position: 'relative',
        padding: '10px 14px',
        background: 'rgba(15, 23, 28, 0.85)',
        border: '1px solid rgba(94,234,212,0.25)',
        borderRadius: 12,
        fontFamily: 'var(--mono)',
        fontSize: 11,
        color: '#cbd5e1',
        lineHeight: 1.5,
        maxWidth: 280,
      }}
    >
      <div style={{ color: '#5EEAD4', fontSize: 10, marginBottom: 4, letterSpacing: '1px' }}>
        {t('labels.intelUpper')}
      </div>
      <div key={factIdx} className="fact-fade">
        {fact}
      </div>
    </div>
  );
}

function StatusFooter(p: ViewProps) {
  const t = useTranslations('scan');
  if (p.scanFailed) {
    return (
      <p
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 12,
          color: '#fb7185',
          textAlign: 'center',
          margin: 0,
        }}
      >
        {t('statusMsg.failed')}
      </p>
    );
  }
  let msg: React.ReactNode;
  if (p.scanCompleted) {
    msg = t('statusMsg.complete');
  } else if (p.finalizing) {
    msg = t('statusMsg.finalising');
  } else {
    msg = (
      <>
        {t('statusMsg.etaPrefix')} <span>{fmtTime(p.etaSeconds)}</span>
      </>
    );
  }
  return (
    <div style={{ textAlign: 'center' }}>
      <p
        aria-live="polite"
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 12,
          color: '#94a3b8',
          margin: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {msg}
      </p>
      {p.etaOverrun && !p.stuck && (
        <StatusBanner
          tone="info"
          title={t('banners.overrunTitle')}
          body={t('banners.overrunBody')}
        />
      )}
      {p.stuck && p.usingRealStream && (
        <StatusBanner
          tone="warn"
          title={t('banners.stuckTitle')}
          body={t('banners.stuckBody')}
          action={{ label: t('banners.startNewScan'), onClick: p.retryNavigateHome }}
        />
      )}
    </div>
  );
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.max(0, Math.floor(s % 60));
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function useRollingLogs(moduleId: string | undefined) {
  const [logs, setLogs] = useState<string[]>([]);
  useEffect(() => {
    const pool = (moduleId && MODULE_LOG_LINES[moduleId]) || DEFAULT_LOG_LINES;
    setLogs(pool.slice(0, 1));
    let i = 1;
    const t = setInterval(() => {
      setLogs((prev) => {
        const next = pool[i % pool.length];
        i += 1;
        return [...prev.slice(-2), next];
      });
    }, 900);
    return () => clearInterval(t);
  }, [moduleId]);
  return logs;
}

function ScanFailedCard({
  scanId,
  onRetry,
  variant,
}: {
  scanId: string;
  onRetry: () => void;
  variant?: 'matrix' | 'hacker';
}) {
  const t = useTranslations('scan.failed');
  if (variant === 'matrix') {
    return (
      <div role="alert" style={{ marginTop: 10, color: '#f87171', fontFamily: 'var(--mono)' }}>
        <div>{t('matrixHeader')}</div>
        <div style={{ opacity: 0.75 }}>{t('matrixBody', { scanId })}</div>
        <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onRetry}
            style={{
              padding: '6px 12px',
              fontFamily: 'var(--mono)',
              fontSize: 12,
              background: 'transparent',
              color: '#fbbf24',
              border: '1px solid rgba(251,191,36,0.5)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {t('matrixRetry')}
          </button>
          <Link
            href="/dashboard"
            style={{
              padding: '6px 12px',
              fontFamily: 'var(--mono)',
              fontSize: 12,
              color: '#86efac',
              border: '1px solid rgba(34,197,94,0.45)',
              borderRadius: 4,
              textDecoration: 'none',
            }}
          >
            {t('matrixDashboard')}
          </Link>
        </div>
      </div>
    );
  }
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
      <strong style={{ color: '#fb7185', display: 'block', marginBottom: 6, fontSize: 15 }}>
        {t('title')}
      </strong>
      <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 14px', lineHeight: 1.6 }}>
        {t('body')}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={onRetry}
          className="btn-primary"
          style={{ padding: '8px 16px', fontSize: 13, minHeight: 0 }}
        >
          {t('startNew')}
        </button>
        <Link
          href="/dashboard"
          className="btn-secondary"
          style={{ padding: '8px 16px', fontSize: 13, minHeight: 0 }}
        >
          {t('backToDashboard')}
        </Link>
        <code
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: '#71717A',
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
      ? { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.35)', fg: '#fbbf24' }
      : { bg: 'rgba(13,148,136,0.08)', border: 'rgba(13,148,136,0.30)', fg: '#5EEAD4' };
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
      <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0, lineHeight: 1.6 }}>
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

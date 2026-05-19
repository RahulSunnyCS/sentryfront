'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { IconArrowRight, IconCheckCircle, IconAlertCircle, IconSpinner } from '@/components/icons';
import { useToast } from '@/components/toast';

type Step = 1 | 2 | 3 | 4 | 5;
type Target = 'web' | 'code';
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface TestType {
  key: string;
  name: string;
  severity: Exclude<Severity, 'low' | 'info'>;
  default: boolean;
  desc: string;
}

const TEST_TYPES: TestType[] = [
  { key: 'sqli', name: 'SQL & NoSQL Injection', severity: 'critical', default: true, desc: 'Probe query parameters and form inputs with classic + blind payloads.' },
  { key: 'xss', name: 'Cross-Site Scripting (XSS)', severity: 'critical', default: true, desc: 'Reflected, stored, and DOM-based payloads, including framework-specific bypasses.' },
  { key: 'fuzz', name: 'API Endpoint Fuzzing', severity: 'high', default: true, desc: 'Discover hidden routes and test for unauthenticated data access.' },
  { key: 'auth', name: 'Authentication Bypass', severity: 'high', default: false, desc: 'Try common bypass techniques on protected routes (token tampering, parameter pollution).' },
  { key: 'cors', name: 'CORS Misconfiguration', severity: 'medium', default: false, desc: 'Look for wildcard or reflected origins that let third-party sites read your data.' },
];

const SEVERITY_TONE: Record<Severity, { color: string; bg: string }> = {
  critical: { color: '#DC2626', bg: 'rgba(220,38,38,0.12)' },
  high: { color: '#F59E0B', bg: 'rgba(245,158,11,0.14)' },
  medium: { color: '#CA8A04', bg: 'rgba(202,138,4,0.12)' },
  low: { color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
  info: { color: '#0891B2', bg: 'rgba(8,145,178,0.12)' },
};

interface ProgressState {
  probe: string;
  label: string;
  index: number;
  total: number;
  state: 'running' | 'complete';
}

interface FindingPayload {
  id: string;
  probe: string;
  title: string;
  severity: Severity;
  sent: string;
  received: string;
  impact: string;
  prompt: string;
}

interface ResultsPayload {
  scan_id: string;
  domain: string;
  tests: string[];
  findings: FindingPayload[];
  passed: string[];
  status: string;
}

interface Props {
  initialDomain?: string;
}

export function ActiveTestFlow({ initialDomain = '' }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [target, setTarget] = useState<Target>('web');
  const [domain, setDomain] = useState(initialDomain);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(TEST_TYPES.filter((t) => t.default).map((t) => t.key)),
  );

  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'checking' | 'verified' | 'unverified' | 'error'>('idle');

  const [scanId, setScanId] = useState<string | null>(null);
  const [estimatedSeconds, setEstimatedSeconds] = useState<number | null>(null);
  const [progressByProbe, setProgressByProbe] = useState<Record<string, ProgressState>>({});
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);

  const toast = useToast();

  const submittedDomain = useRef<string | null>(null);

  const toggleTest = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setStep(1);
    setScanId(null);
    setProgressByProbe({});
    setResults(null);
    setResultsError(null);
    setVerificationStatus('idle');
    submittedDomain.current = null;
  }, []);

  const checkVerification = useCallback(async () => {
    setVerificationStatus('checking');
    try {
      const response = await fetch('/api/v1/verify/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        verified_at?: string | null;
        error?: string;
      };
      if (!response.ok) {
        setVerificationStatus('error');
        toast.error(data.error ?? 'Verification check failed.');
        return false;
      }
      if (data.verified_at) {
        setVerificationStatus('verified');
        return true;
      }
      setVerificationStatus('unverified');
      return false;
    } catch (err) {
      setVerificationStatus('error');
      toast.error(err instanceof Error ? err.message : 'Network error.');
      return false;
    }
  }, [domain, toast]);

  const startTest = useCallback(async () => {
    setProgressByProbe({});
    setResults(null);
    submittedDomain.current = domain;

    const tests = Array.from(selected);
    const idempotencyKey = `${domain}-${tests.sort().join(',')}-${Date.now()}`;

    try {
      const response = await fetch('/api/v1/active-test/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ domain, tests }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        scan_id?: string;
        estimated_seconds?: number;
        code?: string;
        error?: string;
      };

      if (response.status === 403 && data.code === 'DOMAIN_NOT_VERIFIED') {
        setVerificationStatus('unverified');
        setStep(2);
        return;
      }
      if (!response.ok || !data.scan_id) {
        toast.error(data.error ?? 'Failed to start the active test.');
        return;
      }

      setScanId(data.scan_id);
      setEstimatedSeconds(data.estimated_seconds ?? null);
      setStep(4);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Network error.');
    }
  }, [domain, selected, toast]);

  // SSE listener for /progress
  useEffect(() => {
    if (step !== 4 || !scanId) return;

    const source = new EventSource(`/api/v1/active-test/${scanId}/progress`);

    const onProbeStarted = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as ProgressState;
        setProgressByProbe((prev) => ({ ...prev, [data.probe]: { ...data, state: 'running' } }));
      } catch {
        /* ignore */
      }
    };

    const onProbeComplete = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as ProgressState;
        setProgressByProbe((prev) => ({ ...prev, [data.probe]: { ...data, state: 'complete' } }));
      } catch {
        /* ignore */
      }
    };

    const onScanComplete = () => {
      source.close();
      setStep(5);
    };

    const onScanFailed = () => {
      source.close();
      toast.error('The active test failed unexpectedly. Please try again.');
    };

    source.addEventListener('probe_started', onProbeStarted as EventListener);
    source.addEventListener('probe_complete', onProbeComplete as EventListener);
    source.addEventListener('scan_complete', onScanComplete);
    source.addEventListener('scan_failed', onScanFailed);
    source.onerror = () => {
      // EventSource auto-reconnects; we only break out on explicit terminal events.
    };

    return () => {
      source.removeEventListener('probe_started', onProbeStarted as EventListener);
      source.removeEventListener('probe_complete', onProbeComplete as EventListener);
      source.removeEventListener('scan_complete', onScanComplete);
      source.removeEventListener('scan_failed', onScanFailed);
      source.close();
    };
  }, [step, scanId]);

  // Fetch /results when entering Step 5
  useEffect(() => {
    if (step !== 5 || !scanId) return;
    let cancelled = false;
    (async () => {
      setResultsError(null);
      try {
        const response = await fetch(`/api/v1/active-test/${scanId}/results`);
        const data = (await response.json().catch(() => ({}))) as ResultsPayload & { error?: string };
        if (cancelled) return;
        if (!response.ok) {
          const msg = data.error ?? 'Failed to load results.';
          setResultsError(msg);
          toast.error(msg);
          return;
        }
        setResults(data);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Network error.';
        setResultsError(msg);
        toast.error(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, scanId]);

  const selectedTests = useMemo(() => Array.from(selected), [selected]);

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <StepRail step={step} />

      {step === 1 && (
        <Step1
          target={target}
          setTarget={setTarget}
          domain={domain}
          setDomain={setDomain}
          domainError={domainError}
          setDomainError={setDomainError}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <Step2
          domain={domain}
          status={verificationStatus}
          onCheck={async () => {
            const ok = await checkVerification();
            if (ok) setStep(3);
          }}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <Step3
          domain={domain}
          selected={selected}
          toggle={toggleTest}
          onBack={() => setStep(2)}
          onStart={startTest}
        />
      )}

      {step === 4 && (
        <Step4
          domain={domain}
          tests={selectedTests}
          progressByProbe={progressByProbe}
          estimatedSeconds={estimatedSeconds}
          onCancel={reset}
        />
      )}

      {step === 5 && (
        <Step5 results={results} error={resultsError} onRestart={reset} />
      )}
    </div>
  );
}

/* ───── Step rail ───── */
function StepRail({ step }: { step: Step }) {
  const labels = ['Target', 'Verify', 'Tests', 'Run', 'Results'];
  return (
    <ol
      aria-label="Active test progress"
      style={{
        listStyle: 'none',
        padding: 0,
        margin: '0 0 var(--space-8)',
        display: 'grid',
        gridTemplateColumns: `repeat(${labels.length}, 1fr)`,
        gap: 4,
      }}
    >
      {labels.map((l, i) => {
        const n = (i + 1) as Step;
        const state = n < step ? 'done' : n === step ? 'now' : 'todo';
        return (
          <li key={l} aria-current={state === 'now' ? 'step' : undefined}>
            <div
              style={{
                height: 4,
                background: state === 'todo' ? 'var(--border)' : state === 'now' ? 'var(--accent)' : 'var(--success)',
                borderRadius: 2,
                marginBottom: 8,
              }}
            />
            <div
              style={{
                fontSize: 'var(--fs-xs)',
                fontWeight: 600,
                color: state === 'todo' ? 'var(--text-tertiary)' : state === 'now' ? 'var(--accent)' : 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {n}. {l}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ───── Step 1 ───── */
function Step1({
  target,
  setTarget,
  domain,
  setDomain,
  domainError,
  setDomainError,
  onNext,
}: {
  target: Target;
  setTarget: (t: Target) => void;
  domain: string;
  setDomain: (v: string) => void;
  domainError: string | null;
  setDomainError: (m: string | null) => void;
  onNext: () => void;
}) {
  const handleNext = () => {
    const trimmed = domain.trim();
    if (!trimmed) {
      setDomainError('Enter a domain to continue.');
      return;
    }
    setDomainError(null);
    onNext();
  };

  return (
    <section aria-label="Choose target" className="card screen-enter" style={{ padding: 'clamp(24px, 4vw, 40px)' }}>
      <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>What should we attack?</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
        We&apos;ll send real probes — choose where they should land.
      </p>
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(13,148,136,0.07), rgba(124,58,237,0.05))',
          border: '1px solid rgba(13,148,136,0.25)',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1.2 }} aria-hidden="true">🔓</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Why this is different from your passive scan
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Passive scans only see what an anonymous visitor sees. Active testing logs in (when you provide credentials),
            follows real flows, and confirms whether vulnerabilities are actually exploitable — not just present in HTTP responses.
          </p>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <TargetCard
          emoji="🌐"
          title="Live website"
          desc="Hit a verified URL with real attack traffic."
          active={target === 'web'}
          color="#DC2626"
          onClick={() => setTarget('web')}
        />
        <TargetCard
          emoji="📋"
          title="GitHub repository"
          desc="Coming soon — codebase scanning for secrets, vulnerable deps, and anti-patterns."
          active={false}
          disabled
          color="#7C3AED"
          onClick={() => {}}
        />
      </div>

      {target === 'web' && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <label htmlFor="active-test-domain" style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
            Domain to test
          </label>
          <input
            id="active-test-domain"
            data-testid="active-test-domain-input"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value);
              setDomainError(null);
            }}
            placeholder="example.com"
            className="field"
          />
          {domainError && (
            <p role="alert" style={{ fontSize: 'var(--fs-sm)', color: '#E11D48', marginTop: 'var(--space-2)' }}>
              {domainError}
            </p>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button data-testid="active-test-step1-continue" type="button" className="btn-primary" onClick={handleNext} disabled={target !== 'web'}>
          Continue
          <IconArrowRight size={16} color="#fff" />
        </button>
      </div>
    </section>
  );
}

function TargetCard({
  emoji,
  title,
  desc,
  active,
  disabled = false,
  color,
  onClick,
}: {
  emoji: string;
  title: string;
  desc: string;
  active: boolean;
  disabled?: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        textAlign: 'left',
        background: active ? `${color}10` : 'var(--surface-secondary)',
        border: `2px solid ${active ? color : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'all 0.15s ease',
      }}
    >
      <div aria-hidden="true" style={{ fontSize: 28, marginBottom: 'var(--space-2)' }}>{emoji}</div>
      <strong style={{ display: 'block', fontSize: 'var(--fs-lg)', marginBottom: 4 }}>{title}</strong>
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>{desc}</span>
    </button>
  );
}

/* ───── Step 2 ───── */
function Step2({
  domain,
  status,
  onCheck,
  onBack,
}: {
  domain: string;
  status: 'idle' | 'checking' | 'verified' | 'unverified' | 'error';
  onCheck: () => void | Promise<void>;
  onBack: () => void;
}) {
  return (
    <section aria-label="Verify domain" className="card screen-enter" style={{ padding: 'clamp(24px, 4vw, 40px)' }}>
      <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>Verify domain ownership</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
        Active scans only run against domains you can prove you control.{' '}
        <strong style={{ color: 'var(--text)' }}>{domain || 'this domain'}</strong>{' '}
        — we&apos;ll check below.
      </p>

      <div
        style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(220,38,38,0.06))',
          border: '1px solid rgba(245,158,11,0.30)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4) var(--space-5)',
          marginBottom: 'var(--space-6)',
          fontSize: 'var(--fs-sm)',
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
        }}
      >
        <strong style={{ color: 'var(--text)' }}>Why this matters: </strong>
        unauthorized active testing is a felony under the US Computer Fraud and Abuse Act (and its global equivalents).
        Verification is your authorization on record.
      </div>

      {status === 'unverified' && (
        <div role="alert" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: '#DC2626', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-5)' }}>
          We couldn&apos;t confirm ownership of <strong>{domain}</strong>. Run the verify wizard, then come back.
        </div>
      )}
      {status === 'verified' && (
        <div role="status" style={{ background: 'rgba(5,150,105,0.10)', border: '1px solid rgba(5,150,105,0.30)', color: 'var(--success)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-5)' }}>
          ✓ Verified — you&apos;re authorized to run tests against {domain}.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary" onClick={onBack}>← Back</button>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Link href={`/verify?domain=${encodeURIComponent(domain)}`} className="btn-secondary">
            Open verify wizard
          </Link>
          <button data-testid="active-test-check-verification" type="button" className="btn-primary" onClick={onCheck} disabled={status === 'checking'}>
            {status === 'checking' ? 'Checking…' : 'Check verification'}
            <IconArrowRight size={16} color="#fff" />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ───── Step 3 ───── */
function Step3({
  domain,
  selected,
  toggle,
  onBack,
  onStart,
}: {
  domain: string;
  selected: Set<string>;
  toggle: (k: string) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const count = selected.size;
  return (
    <section aria-label="Choose tests" className="card screen-enter" style={{ padding: 'clamp(24px, 4vw, 40px)' }}>
      <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>What should we try?</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
        <strong style={{ color: 'var(--text)' }}>{domain}</strong>{' '}
        <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Verified</span>{' '}
        — you&apos;re authorized to run these tests.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {TEST_TYPES.map((t) => {
          const tone = SEVERITY_TONE[t.severity];
          const isOn = selected.has(t.key);
          return (
            <li key={t.key}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  background: isOn ? 'var(--surface-secondary)' : 'var(--surface)',
                  border: `1px solid ${isOn ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggle(t.key)}
                  style={{ marginTop: 4, width: 18, height: 18, accentColor: 'var(--accent)' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 4 }}>
                    <strong style={{ fontSize: 'var(--fs-md)' }}>{t.name}</strong>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: tone.color, background: tone.bg, padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                      {t.severity}
                    </span>
                  </div>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{t.desc}</p>
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      <aside
        style={{
          background: 'rgba(245,158,11,0.07)',
          border: '1px solid rgba(245,158,11,0.30)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4) var(--space-5)',
          marginBottom: 'var(--space-6)',
          fontSize: 'var(--fs-sm)',
          color: 'var(--text-secondary)',
        }}
      >
        <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 'var(--space-2)' }}>
          Heads up — Phase 2 stub
        </strong>
        Real attack probes ship in Phase 5. Today this runs the orchestration end-to-end (rate-limit, gating, progress
        streaming, results) but does not send any payloads to your site.
      </aside>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary" onClick={onBack}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
            <strong style={{ color: 'var(--text)' }}>{count} test{count === 1 ? '' : 's'}</strong>
          </span>
          <button data-testid="active-test-start" type="button" className="btn-primary" onClick={onStart} disabled={count === 0}>
            Start active test
            <IconArrowRight size={16} color="#fff" />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ───── Step 4 ───── */
function Step4({
  domain,
  tests,
  progressByProbe,
  estimatedSeconds,
  onCancel,
}: {
  domain: string;
  tests: string[];
  progressByProbe: Record<string, ProgressState>;
  estimatedSeconds: number | null;
  onCancel: () => void;
}) {
  return (
    <section aria-label="Active test in progress" className="card screen-enter" style={{ padding: 'clamp(24px, 4vw, 40px)' }}>
      <h2 className="text-h3" style={{ marginBottom: 'var(--space-2)' }}>
        Active testing in progress — <span style={{ color: 'var(--accent)' }}>{domain}</span>
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
        {estimatedSeconds
          ? `Estimated ~${estimatedSeconds} seconds. Streaming progress live.`
          : 'Streaming progress live.'}
      </p>

      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {tests.map((probe) => {
          const entry = progressByProbe[probe];
          const state: 'todo' | 'now' | 'done' = !entry ? 'todo' : entry.state === 'complete' ? 'done' : 'now';
          const label = entry?.label ?? probe;
          return (
            <li
              key={probe}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                background: state === 'now' ? 'var(--surface-secondary)' : 'transparent',
                opacity: state === 'todo' ? 0.5 : 1,
              }}
            >
              <span style={{ width: 22, display: 'flex', justifyContent: 'center' }} aria-hidden="true">
                {state === 'done' ? (
                  <IconCheckCircle size={18} color="var(--success)" />
                ) : state === 'now' ? (
                  <IconSpinner size={18} />
                ) : (
                  <span style={{ width: 8, height: 8, background: 'var(--border)', borderRadius: 8 }} />
                )}
              </span>
              <span style={{ flex: 1, fontSize: 'var(--fs-base)', fontWeight: state === 'todo' ? 400 : 500 }}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-6)', textAlign: 'center' }}>
        All requests would include <code style={{ fontFamily: 'var(--mono)' }}>X-Scanner: VibeSafe-DAST</code> when probes are wired in Phase 5.
      </p>
      <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
        <button type="button" className="btn-secondary" onClick={onCancel} style={{ fontSize: 'var(--fs-sm)' }}>
          Cancel and start over
        </button>
      </div>
    </section>
  );
}

/* ───── Step 5 ───── */
function Step5({
  results,
  error,
  onRestart,
}: {
  results: ResultsPayload | null;
  error: string | null;
  onRestart: () => void;
}) {
  if (error) {
    return (
      <section className="card" style={{ padding: 'clamp(24px, 4vw, 40px)' }}>
        <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>Couldn&apos;t load results</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
          There was a problem loading your results.
        </p>
        <button type="button" className="btn-secondary" onClick={onRestart}>← Run another test</button>
      </section>
    );
  }

  if (!results) {
    return (
      <section className="card" style={{ padding: 'clamp(24px, 4vw, 40px)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading results…</p>
      </section>
    );
  }

  const findingCount = results.findings.length;
  const headerTone = findingCount > 0 ? 'rgba(220,38,38,0.30)' : 'rgba(5,150,105,0.30)';
  const headerGradient = findingCount > 0
    ? 'linear-gradient(135deg, rgba(220,38,38,0.10), rgba(124,58,237,0.06))'
    : 'linear-gradient(135deg, rgba(5,150,105,0.10), rgba(13,148,136,0.06))';
  const headerLabelColor = findingCount > 0 ? '#DC2626' : 'var(--success)';

  return (
    <section data-testid="active-test-results" aria-label="Active test results" className="screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <header
        style={{
          background: headerGradient,
          border: `1px solid ${headerTone}`,
          borderRadius: 'var(--radius-lg)',
          padding: 'clamp(20px, 4vw, 28px) clamp(20px, 4vw, 32px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: headerLabelColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Active test complete
          </div>
          <h2 className="text-h3" style={{ margin: 0 }}>
            {findingCount > 0
              ? `${findingCount} CONFIRMED finding${findingCount === 1 ? '' : 's'} on `
              : `No findings — `}
            <span style={{ color: 'var(--accent)' }}>{results.domain}</span>
          </h2>
        </div>
        <span
          style={{
            background: findingCount > 0 ? '#DC2626' : 'var(--success)',
            color: '#fff',
            padding: '6px 14px',
            borderRadius: 'var(--radius-xl)',
            fontSize: 'var(--fs-sm)',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          {findingCount} CONFIRMED
        </span>
      </header>

      {results.findings.map((f) => (
        <ConfirmedCard key={f.id} finding={f} />
      ))}

      <aside
        style={{
          background: 'rgba(5,150,105,0.07)',
          border: '1px solid rgba(5,150,105,0.30)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5) var(--space-6)',
        }}
      >
        <strong style={{ color: 'var(--success)', display: 'block', marginBottom: 'var(--space-2)' }}>
          ✓ {results.passed.length} test{results.passed.length === 1 ? '' : 's'} passed
        </strong>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {results.passed.map((p) => (
            <li key={p}>✓ {labelForProbe(p)}</li>
          ))}
        </ul>
      </aside>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary" onClick={onRestart}>← Run another test</button>
        <Link href="/dashboard" className="btn-primary">
          Back to dashboard
          <IconArrowRight size={16} color="#fff" />
        </Link>
      </div>
    </section>
  );
}

function labelForProbe(key: string): string {
  return TEST_TYPES.find((t) => t.key === key)?.name ?? key;
}

function ConfirmedCard({ finding }: { finding: FindingPayload }) {
  const [copied, setCopied] = useState(false);
  const tone = SEVERITY_TONE[finding.severity] ?? SEVERITY_TONE.info;

  const copy = () => {
    navigator.clipboard?.writeText(finding.prompt).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      },
      () => {},
    );
  };

  return (
    <article className="card">
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <IconAlertCircle size={22} color={tone.color} aria-hidden="true" />
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, marginBottom: 4 }}>{finding.title}</h3>
          <span
            style={{
              fontSize: 'var(--fs-xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: tone.color,
              background: tone.bg,
              padding: '3px 10px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Confirmed exploit · {finding.severity}
          </span>
        </div>
      </header>

      <DetailRow label="Probe sent" value={finding.sent} mono />
      <DetailRow label="Response received" value={finding.received} mono />

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={detailLabelCss}>Impact</div>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{finding.impact}</p>
      </div>

      <div
        style={{
          background: 'linear-gradient(135deg, rgba(13,148,136,0.10), rgba(20,184,166,0.05))',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4) var(--space-5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <strong style={{ color: 'var(--accent)', fontSize: 'var(--fs-sm)' }}>🤖 AI fix prompt</strong>
          <button
            type="button"
            onClick={copy}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--fs-xs)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <pre style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
          {finding.prompt}
        </pre>
      </div>
    </article>
  );
}

const detailLabelCss: React.CSSProperties = {
  fontSize: 'var(--fs-xs)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-tertiary)',
  marginBottom: 6,
};

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <div style={detailLabelCss}>{label}</div>
      <div
        style={{
          background: 'var(--surface-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-2) var(--space-3)',
          fontFamily: mono ? 'var(--mono)' : 'var(--font)',
          fontSize: 'var(--fs-sm)',
          color: 'var(--text-secondary)',
          overflowX: 'auto',
          wordBreak: 'break-all',
        }}
      >
        {value}
      </div>
    </div>
  );
}

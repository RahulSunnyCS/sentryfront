'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconArrowRight, IconCheckCircle, IconAlertCircle, IconSpinner } from '@/components/icons';

type Step = 1 | 2 | 3 | 4 | 5;
type Target = 'web' | 'code';
type Severity = 'critical' | 'high' | 'medium';

interface TestType {
  key: string;
  name: string;
  severity: Severity;
  default: boolean;
  desc: string;
}

const TEST_TYPES: TestType[] = [
  { key: 'sqli',  name: 'SQL & NoSQL Injection',       severity: 'critical', default: true,  desc: 'Probe query parameters and form inputs with classic + blind payloads.' },
  { key: 'xss',   name: 'Cross-Site Scripting (XSS)',  severity: 'critical', default: true,  desc: 'Reflected, stored, and DOM-based payloads, including framework-specific bypasses.' },
  { key: 'fuzz',  name: 'API Endpoint Fuzzing',        severity: 'high',     default: true,  desc: 'Discover hidden routes and test for unauthenticated data access.' },
  { key: 'auth',  name: 'Authentication Bypass',       severity: 'high',     default: false, desc: 'Try common bypass techniques on protected routes (token tampering, parameter pollution).' },
  { key: 'cors',  name: 'CORS Misconfiguration',       severity: 'medium',   default: false, desc: 'Look for wildcard or reflected origins that let third-party sites read your data.' },
];

const SEVERITY_TONE: Record<Severity, { color: string; bg: string }> = {
  critical: { color: '#DC2626', bg: 'rgba(220,38,38,0.12)' },
  high:     { color: '#F59E0B', bg: 'rgba(245,158,11,0.14)' },
  medium:   { color: '#CA8A04', bg: 'rgba(202,138,4,0.12)' },
};

const PROGRESS_STEPS = [
  'Discovering endpoints and form inputs…',
  'Sending SQL injection probes…',
  'Testing 12 XSS payloads…',
  'API endpoint fuzzing…',
  'Generating CONFIRMED finding report…',
];

const CONFIRMED_FINDINGS = [
  {
    title: 'SQL Injection — /api/users?id=',
    severity: 'critical' as const,
    sent:    `GET /api/users?id=1' OR '1'='1`,
    received: '200 OK · [{id:1,…},{id:2,…},…] (returned 14,302 rows)',
    impact:  'Attacker can dump the entire users table — emails, password hashes, session tokens.',
    prompt:  `Sanitize the id parameter in /api/users. Use a parameterized query (e.g. \`SELECT * FROM users WHERE id = $1\` with a numeric cast) and reject non-numeric inputs at the route boundary. Add a regression test that POSTs OR '1'='1 and expects a 400.`,
  },
  {
    title: 'Reflected XSS — /search?q=',
    severity: 'critical' as const,
    sent:    `GET /search?q=<script>alert(document.cookie)</script>`,
    received: '200 OK · payload reflected un-escaped inside <h1>',
    impact:  'Attacker can steal session cookies or hijack accounts by sending a malicious link.',
    prompt:  `Escape the q query parameter before rendering. If using React, render it through {q} (default JSX escaping); for server-side templates, use the framework's HTML-escape helper. Add a CSP that forbids inline scripts.`,
  },
];

const PASSED = ['CORS: properly configured', 'Auth bypass: not vulnerable', 'API fuzzing: no unauthorized endpoints'];

export function ActiveTestFlow() {
  const [step, setStep] = useState<Step>(1);
  const [target, setTarget] = useState<Target>('web');
  const [selected, setSelected] = useState<Set<string>>(
    new Set(TEST_TYPES.filter((t) => t.default).map((t) => t.key)),
  );

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <StepRail step={step} />
      {step === 1 && <Step1 target={target} setTarget={setTarget} onNext={() => setStep(2)} />}
      {step === 2 && <Step2 onBack={() => setStep(1)} onNext={() => setStep(3)} />}
      {step === 3 && (
        <Step3
          selected={selected}
          toggle={(k) =>
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(k)) next.delete(k);
              else next.add(k);
              return next;
            })
          }
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}
      {step === 4 && <Step4 onSkip={() => setStep(5)} />}
      {step === 5 && <Step5 onBack={() => setStep(1)} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Step rail
   ───────────────────────────────────────────────────────────── */

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
                background:
                  state === 'todo' ? 'var(--border)' : state === 'now' ? 'var(--accent)' : 'var(--success)',
                borderRadius: 2,
                marginBottom: 8,
              }}
            />
            <div
              style={{
                fontSize: 'var(--fs-xs)',
                fontWeight: 600,
                color:
                  state === 'todo' ? 'var(--text-tertiary)' : state === 'now' ? 'var(--accent)' : 'var(--text-secondary)',
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

/* ─────────────────────────────────────────────────────────────
   Step 1 — choose target
   ───────────────────────────────────────────────────────────── */

function Step1({ target, setTarget, onNext }: { target: Target; setTarget: (t: Target) => void; onNext: () => void }) {
  return (
    <section aria-label="Choose target" className="card screen-enter" style={{ padding: 'clamp(24px, 4vw, 40px)' }}>
      <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>What should we attack?</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
        We&apos;ll send real probes — choose where they should land.
      </p>
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
          desc="Scan the codebase for secrets, vulnerable deps, and anti-patterns."
          active={target === 'code'}
          color="#7C3AED"
          onClick={() => setTarget('code')}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn-primary" onClick={onNext}>
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
  color,
  onClick,
}: {
  emoji: string;
  title: string;
  desc: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        background: active ? `${color}10` : 'var(--surface-secondary)',
        border: `2px solid ${active ? color : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <div aria-hidden="true" style={{ fontSize: 28, marginBottom: 'var(--space-2)' }}>{emoji}</div>
      <strong style={{ display: 'block', fontSize: 'var(--fs-lg)', marginBottom: 4 }}>{title}</strong>
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>{desc}</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Step 2 — verify (intro + link)
   ───────────────────────────────────────────────────────────── */

function Step2({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <section aria-label="Verify domain" className="card screen-enter" style={{ padding: 'clamp(24px, 4vw, 40px)' }}>
      <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>Verify domain ownership</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
        Active scans only run against domains you can prove you control. Pick DNS or meta tag — most people are done in
        under 60 seconds.
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
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary" onClick={onBack}>← Back</button>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Link href="/verify" className="btn-secondary">Open verify wizard</Link>
          <button type="button" className="btn-primary" onClick={onNext}>
            I&apos;ve verified — continue
            <IconArrowRight size={16} color="#fff" />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Step 3 — select tests
   ───────────────────────────────────────────────────────────── */

function Step3({
  selected,
  toggle,
  onBack,
  onNext,
}: {
  selected: Set<string>;
  toggle: (k: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const count = selected.size;
  return (
    <section aria-label="Choose tests" className="card screen-enter" style={{ padding: 'clamp(24px, 4vw, 40px)' }}>
      <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>What should we try?</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
        <strong style={{ color: 'var(--text)' }}>taskflow.app</strong>{' '}
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
                    <span
                      style={{
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: tone.color,
                        background: tone.bg,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      {t.severity}
                    </span>
                  </div>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {t.desc}
                  </p>
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      {/* Safety guarantees */}
      <aside
        style={{
          background: 'rgba(5,150,105,0.07)',
          border: '1px solid rgba(5,150,105,0.30)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4) var(--space-5)',
          marginBottom: 'var(--space-6)',
          fontSize: 'var(--fs-sm)',
          color: 'var(--text-secondary)',
        }}
      >
        <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 'var(--space-2)' }}>
          Safety guarantees
        </strong>
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          <li>✓ Rate limited (1 req/sec)</li>
          <li>✓ No destructive payloads</li>
          <li>✓ X-Scanner: VibeSafe-DAST header</li>
          <li>✓ Scope locked to verified domain</li>
        </ul>
      </aside>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
        }}
      >
        <button type="button" className="btn-secondary" onClick={onBack}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
            <strong style={{ color: 'var(--text)' }}>3 credits</strong> · ~8 minutes
          </span>
          <button type="button" className="btn-primary" onClick={onNext} disabled={count === 0}>
            Start active test
            <IconArrowRight size={16} color="#fff" />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Step 4 — live progress
   ───────────────────────────────────────────────────────────── */

function Step4({ onSkip }: { onSkip: () => void }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (idx >= PROGRESS_STEPS.length) return;
    const handle = window.setTimeout(() => setIdx((i) => i + 1), 1800);
    return () => window.clearTimeout(handle);
  }, [idx]);

  useEffect(() => {
    if (idx >= PROGRESS_STEPS.length) {
      const handle = window.setTimeout(onSkip, 800);
      return () => window.clearTimeout(handle);
    }
  }, [idx, onSkip]);

  return (
    <section aria-label="Active test in progress" className="card screen-enter" style={{ padding: 'clamp(24px, 4vw, 40px)' }}>
      <h2 className="text-h3" style={{ marginBottom: 'var(--space-2)' }}>
        Active testing in progress — <span style={{ color: 'var(--accent)' }}>taskflow.app</span>
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
        Sending real attack probes — this is what attackers do.
      </p>

      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {PROGRESS_STEPS.map((step, i) => {
          const state = i < idx ? 'done' : i === idx ? 'now' : 'todo';
          return (
            <li
              key={step}
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
              <span style={{ flex: 1, fontSize: 'var(--fs-base)', fontWeight: state === 'todo' ? 400 : 500 }}>{step}</span>
            </li>
          );
        })}
      </ol>

      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-6)', textAlign: 'center' }}>
        All requests include <code style={{ fontFamily: 'var(--mono)' }}>X-Scanner: VibeSafe-DAST</code> · Rate limited to 1 req/sec
      </p>
      <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
        <button type="button" className="btn-secondary" onClick={onSkip} style={{ fontSize: 'var(--fs-sm)' }}>
          Skip to results (demo)
        </button>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Step 5 — results
   ───────────────────────────────────────────────────────────── */

function Step5({ onBack }: { onBack: () => void }) {
  return (
    <section aria-label="Active test results" className="screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <header
        style={{
          background: 'linear-gradient(135deg, rgba(220,38,38,0.10), rgba(124,58,237,0.06))',
          border: '1px solid rgba(220,38,38,0.30)',
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
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Active test complete
          </div>
          <h2 className="text-h3" style={{ margin: 0 }}>
            2 CONFIRMED exploitable vulnerabilities found on{' '}
            <span style={{ color: 'var(--accent)' }}>taskflow.app</span>
          </h2>
        </div>
        <span
          style={{
            background: '#DC2626',
            color: '#fff',
            padding: '6px 14px',
            borderRadius: 'var(--radius-xl)',
            fontSize: 'var(--fs-sm)',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          2 CONFIRMED
        </span>
      </header>

      {CONFIRMED_FINDINGS.map((f) => (
        <ConfirmedCard key={f.title} {...f} />
      ))}

      {/* Passed checks */}
      <aside
        style={{
          background: 'rgba(5,150,105,0.07)',
          border: '1px solid rgba(5,150,105,0.30)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5) var(--space-6)',
        }}
      >
        <strong style={{ color: 'var(--success)', display: 'block', marginBottom: 'var(--space-2)' }}>
          ✓ {PASSED.length} tests passed (no confirmed vulnerabilities)
        </strong>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {PASSED.map((p) => (
            <li key={p}>✓ {p}</li>
          ))}
        </ul>
      </aside>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary" onClick={onBack}>← Run another test</button>
        <Link href="/report/demo" className="btn-primary">
          Back to passive report
          <IconArrowRight size={16} color="#fff" />
        </Link>
      </div>
    </section>
  );
}

function ConfirmedCard({
  title,
  severity,
  sent,
  received,
  impact,
  prompt,
}: {
  title: string;
  severity: Severity;
  sent: string;
  received: string;
  impact: string;
  prompt: string;
}) {
  const [copied, setCopied] = useState(false);
  const tone = SEVERITY_TONE[severity];

  const copy = () => {
    navigator.clipboard?.writeText(prompt).then(
      () => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); },
      () => {},
    );
  };

  return (
    <article className="card">
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <IconAlertCircle size={22} color={tone.color} aria-hidden="true" />
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, marginBottom: 4 }}>{title}</h3>
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
            Confirmed exploit · {severity}
          </span>
        </div>
      </header>

      <DetailRow label="Probe sent" value={sent} mono />
      <DetailRow label="Response received" value={received} mono />

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={detailLabelCss}>Impact</div>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{impact}</p>
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
        <pre
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            margin: 0,
          }}
        >
          {prompt}
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

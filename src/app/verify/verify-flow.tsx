'use client';

import { useState } from 'react';
import Link from 'next/link';

type Path = 'tech' | 'guided';
type Method = 'dns' | 'meta';

interface Props {
  domain: string;
  token: string;
}

const PLATFORMS: Array<{ key: string; name: string; icon: string; method: Method; steps: string[] }> = [
  { key: 'wix',         name: 'Wix',         icon: '🟣', method: 'meta', steps: ['Open Wix Editor → Settings → Custom code', 'Click "Add Custom Code"', 'Paste the meta tag in <head>, set "All pages"', 'Save and publish your site'] },
  { key: 'squarespace', name: 'Squarespace', icon: '⬛', method: 'meta', steps: ['Settings → Advanced → Code Injection', 'Paste the meta tag into the Header field', 'Save and your site updates instantly'] },
  { key: 'webflow',     name: 'Webflow',     icon: '🔷', method: 'meta', steps: ['Project Settings → Custom Code → Head Code', 'Paste the meta tag', 'Save changes and publish'] },
  { key: 'framer',      name: 'Framer',      icon: '⬡',  method: 'meta', steps: ['Site Settings → General → Custom Code → Head Start', 'Paste the meta tag', 'Publish your site'] },
  { key: 'shopify',     name: 'Shopify',     icon: '🟢', method: 'meta', steps: ['Online Store → Themes → Edit code', 'Open theme.liquid', 'Paste the meta tag inside <head>', 'Save'] },
  { key: 'wordpress',   name: 'WordPress',   icon: '🔵', method: 'meta', steps: ['Install a header/footer plugin (e.g. WPCode)', 'Add the meta tag to "Header"', 'Save and clear any cache'] },
  { key: 'cloudflare',  name: 'Cloudflare',  icon: '🟠', method: 'dns',  steps: ['Open your domain in Cloudflare DNS', 'Add a TXT record — Name: @, Value: the token below', 'Save and wait 1–5 minutes for propagation'] },
  { key: 'vercel',      name: 'Vercel',      icon: '▲',  method: 'dns',  steps: ['Project → Settings → Domains', 'Open your domain → DNS records', 'Add TXT record — Host: @, Value: the token below', 'Save'] },
  { key: 'other',       name: 'Other',       icon: '❓', method: 'dns',  steps: ['Log into your DNS provider', 'Add a TXT record on the apex (@) with the token below', 'Wait 1–5 minutes and click "Verify"'] },
];

export function VerifyFlow({ domain, token }: Props) {
  const [path, setPath] = useState<Path>('tech');
  const [method, setMethod] = useState<Method>('dns');
  const [platformKey, setPlatformKey] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<null | 'ok' | 'fail'>(null);

  const metaTag = `<meta name="vibesafe-verify" content="${token.replace('vibesafe-verify=', '')}" />`;
  const platform = PLATFORMS.find((p) => p.key === platformKey);

  const handleVerify = () => {
    setVerifying(true);
    setResult(null);
    // demo verification — randomised
    window.setTimeout(() => {
      setVerifying(false);
      setResult(Math.random() > 0.2 ? 'ok' : 'fail');
    }, 1200);
  };

  return (
    <>
      {/* Why verify */}
      <aside
        style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(220,38,38,0.06))',
          border: '1px solid rgba(245,158,11,0.30)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5) var(--space-6)',
          marginBottom: 'var(--space-8)',
          display: 'flex',
          gap: 'var(--space-4)',
          alignItems: 'flex-start',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 24, flexShrink: 0 }}>⚖️</span>
        <div>
          <strong style={{ fontSize: 'var(--fs-md)', display: 'block', marginBottom: 4 }}>
            Why we ask
          </strong>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
            Active scans send actual attack probes. The US Computer Fraud and Abuse Act (and its global equivalents) make
            this illegal without authorization. Verifying ownership <strong style={{ color: 'var(--text)' }}>is</strong>{' '}
            your authorization — it&apos;s a one-time setup and can be removed any time.
          </p>
        </div>
      </aside>

      {/* Path selector */}
      <div
        role="tablist"
        aria-label="Verification path"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-3)',
          maxWidth: 640,
          margin: '0 auto var(--space-8)',
        }}
      >
        <PathBtn active={path === 'tech'}   onClick={() => setPath('tech')}   emoji="👨‍💻" title="I'm a developer" desc="Show me DNS / meta options" />
        <PathBtn active={path === 'guided'} onClick={() => setPath('guided')} emoji="🌐" title="I use a builder"   desc="Walk me through it (Wix, Webflow, …)" />
      </div>

      {path === 'tech' ? (
        <section
          aria-label="Technical verification methods"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 'var(--space-5)',
            maxWidth: 1000,
            margin: '0 auto',
          }}
        >
          <MethodCard
            recommended
            active={method === 'dns'}
            onClick={() => setMethod('dns')}
            title="DNS TXT record"
            sub="~60 seconds · most reliable"
          >
            <ol style={olCss}>
              <li>Open your DNS provider</li>
              <li>Add a TXT record:</li>
            </ol>
            <RecordBox lines={[['Type', 'TXT'], ['Name', '@'], ['Value', token]]} />
            <p style={hintCss}>Cloudflare · Namecheap · GoDaddy · Route 53 · Google Domains</p>
            <ol start={3} style={olCss}>
              <li>Wait 1–5 minutes for propagation</li>
              <li>Click verify</li>
            </ol>
          </MethodCard>

          <MethodCard
            active={method === 'meta'}
            onClick={() => setMethod('meta')}
            title="HTML meta tag"
            sub="Use if you can edit your site's HTML"
          >
            <ol style={olCss}>
              <li>Paste this inside the <code style={codeInlineCss}>&lt;head&gt;</code> of your home page:</li>
            </ol>
            <CodeBlock code={metaTag} />
            <ol start={2} style={olCss}>
              <li>Deploy your site so it&apos;s live</li>
              <li>Click verify</li>
            </ol>
          </MethodCard>
        </section>
      ) : (
        <section aria-label="Guided platform walkthrough" style={{ maxWidth: 900, margin: '0 auto' }}>
          {platform == null ? (
            <>
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
                Pick your platform — we&apos;ll show you exactly where to paste the verification.
              </p>
              <ul
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 'var(--space-3)',
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                }}
              >
                {PLATFORMS.map((p) => (
                  <li key={p.key}>
                    <button
                      type="button"
                      onClick={() => { setPlatformKey(p.key); setMethod(p.method); }}
                      className="card card-interactive"
                      style={{
                        width: '100%',
                        background: 'var(--surface)',
                        textAlign: 'center',
                        padding: 'var(--space-5) var(--space-3)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span aria-hidden="true" style={{ fontSize: 24 }}>{p.icon}</span>
                      <strong>{p.name}</strong>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                        {p.method === 'dns' ? 'via DNS' : 'via meta tag'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p style={{ textAlign: 'center', marginTop: 'var(--space-5)', fontSize: 'var(--fs-sm)' }}>
                <button
                  type="button"
                  onClick={() => setPath('tech')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
                >
                  ← I&apos;d rather see the developer view
                </button>
              </p>
            </>
          ) : (
            <article className="card">
              <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                <button
                  type="button"
                  onClick={() => setPlatformKey(null)}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', minHeight: 0 }}
                >
                  ← Other platform
                </button>
                <span aria-hidden="true" style={{ fontSize: 28 }}>{platform.icon}</span>
                <h2 className="text-h3" style={{ margin: 0 }}>{platform.name}</h2>
                <span className="pill" style={{ marginLeft: 'auto' }}>
                  {platform.method === 'dns' ? 'via DNS' : 'via Meta tag'}
                </span>
              </header>
              <ol style={{ ...olCss, paddingLeft: 20 }}>
                {platform.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <div style={{ marginTop: 'var(--space-5)' }}>
                {platform.method === 'dns'
                  ? <RecordBox lines={[['Type', 'TXT'], ['Name', '@'], ['Value', token]]} />
                  : <CodeBlock code={metaTag} />}
              </div>
            </article>
          )}
        </section>
      )}

      {/* Verify action */}
      <div
        style={{
          maxWidth: 640,
          margin: 'var(--space-8) auto 0',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <button type="button" className="btn-primary" onClick={handleVerify} disabled={verifying}>
          {verifying ? 'Verifying…' : `Verify ${method === 'dns' ? 'DNS record' : 'meta tag'} for ${domain}`}
        </button>
        {result === 'ok' && (
          <p role="status" style={{ color: 'var(--success)', fontWeight: 600 }}>
            ✓ Verified — you can now run active tests.{' '}
            <Link href="/active-test" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Continue →</Link>
          </p>
        )}
        {result === 'fail' && (
          <p role="alert" style={{ color: '#E11D48' }}>
            Couldn&apos;t find the record yet. DNS can take up to an hour — try again shortly.
          </p>
        )}

        <ul
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 'var(--space-5)',
            flexWrap: 'wrap',
            listStyle: 'none',
            padding: 0,
            margin: 'var(--space-5) 0 0',
          }}
        >
          {['One-time setup', 'Remove anytime', 'We re-check on each scan', 'No tracking pixel'].map((t) => (
            <li key={t} style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
              ✓ {t}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/* ──── primitives ──── */

const olCss: React.CSSProperties = {
  paddingLeft: 18,
  fontSize: 'var(--fs-base)',
  color: 'var(--text-secondary)',
  lineHeight: 1.9,
};
const hintCss: React.CSSProperties = {
  fontSize: 'var(--fs-xs)',
  color: 'var(--text-tertiary)',
  marginTop: 6,
};
const codeInlineCss: React.CSSProperties = {
  background: 'var(--surface-secondary)',
  padding: '2px 6px',
  borderRadius: 4,
  fontSize: '0.92em',
  fontFamily: 'var(--mono)',
};

function PathBtn({
  active,
  onClick,
  emoji,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: 'var(--space-5)',
        background: active ? 'var(--accent)' : 'var(--surface)',
        color: active ? '#fff' : 'var(--text)',
        border: '1px solid',
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
    >
      <div style={{ fontSize: 22, marginBottom: 6 }} aria-hidden="true">{emoji}</div>
      <strong style={{ display: 'block', fontSize: 'var(--fs-md)' }}>{title}</strong>
      <span style={{ fontSize: 'var(--fs-sm)', opacity: active ? 0.9 : 0.65 }}>{desc}</span>
    </button>
  );
}

function MethodCard({
  recommended,
  active,
  onClick,
  title,
  sub,
  children,
}: {
  recommended?: boolean;
  active?: boolean;
  onClick: () => void;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      style={{
        background: 'var(--surface)',
        border: '2px solid',
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'border-color 0.15s ease',
      }}
    >
      {recommended && (
        <div
          style={{
            position: 'absolute',
            top: -12,
            left: 'var(--space-5)',
            background: 'var(--accent)',
            color: '#fff',
            padding: '3px 10px',
            borderRadius: 'var(--radius-xl)',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Recommended
        </div>
      )}
      <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, marginBottom: 4 }}>{title}</h2>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }}>{sub}</p>
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </article>
  );
}

function RecordBox({ lines }: { lines: Array<[string, string]> }) {
  return (
    <div
      style={{
        background: 'var(--surface-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-4)',
        fontFamily: 'var(--mono)',
        fontSize: 'var(--fs-sm)',
        display: 'grid',
        gridTemplateColumns: '80px 1fr auto',
        rowGap: 6,
        columnGap: 8,
        alignItems: 'center',
        margin: 'var(--space-3) 0',
      }}
    >
      {lines.map(([k, v]) => (
        <ContentsRow key={k} k={k} v={v} />
      ))}
    </div>
  );
}

function ContentsRow({ k, v }: { k: string; v: string }) {
  const copy = () => navigator.clipboard?.writeText(v).catch(() => {});
  return (
    <>
      <span style={{ color: 'var(--text-tertiary)' }}>{k}</span>
      <span style={{ color: 'var(--text)', wordBreak: 'break-all' }}>{v}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${k}`}
        style={{
          background: 'transparent',
          border: '1px solid var(--border)',
          padding: '4px 8px',
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font)',
          cursor: 'pointer',
        }}
      >
        Copy
      </button>
    </>
  );
}

function CodeBlock({ code }: { code: string }) {
  const copy = () => navigator.clipboard?.writeText(code).catch(() => {});
  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--surface-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-4)',
        fontFamily: 'var(--mono)',
        fontSize: 'var(--fs-sm)',
        margin: 'var(--space-3) 0',
        overflowX: 'auto',
      }}
    >
      <code style={{ wordBreak: 'break-all', display: 'block', paddingRight: 64 }}>{code}</code>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy code"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          padding: '4px 10px',
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font)',
          cursor: 'pointer',
        }}
      >
        Copy
      </button>
    </div>
  );
}

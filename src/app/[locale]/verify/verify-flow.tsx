'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useToast } from '@/components/toast';

type Path = 'tech' | 'guided';
type Method = 'dns' | 'meta';

interface Props {
  domain: string;
  token: string;
  alreadyVerified?: boolean;
}

const METHOD_TO_API: Record<Method, 'dns_txt' | 'meta_tag'> = {
  dns: 'dns_txt',
  meta: 'meta_tag',
};

// Platform-specific UI navigation strings (describe English-only platform UIs).
const DNS_FALLBACK_STEPS = [
  'Log into your domain registrar or DNS provider',
  'Add a TXT record — Name: @, Value: the token below',
  'Wait 1–5 minutes for propagation',
  'Click Verify',
];

const META_FALLBACK_STEPS = [
  'Find the "Custom code" or "Header injection" section in your platform settings',
  'Paste the meta tag inside the <head> area',
  'Save and publish so the change is live',
  'Click Verify',
];

const PLATFORMS: Array<{
  key: string;
  name: string;
  icon: string;
  defaultMethod: Method;
  metaSteps: string[];
  dnsSteps: string[];
}> = [
  {
    key: 'wix', name: 'Wix', icon: '🟣', defaultMethod: 'meta',
    metaSteps: ['Open Wix Editor → Settings → Custom code', 'Click "Add Custom Code"', 'Paste the meta tag in <head>, set "All pages"', 'Save and publish your site'],
    dnsSteps: DNS_FALLBACK_STEPS,
  },
  {
    key: 'squarespace', name: 'Squarespace', icon: '⬛', defaultMethod: 'meta',
    metaSteps: ['Settings → Advanced → Code Injection', 'Paste the meta tag into the Header field', 'Save and your site updates instantly'],
    dnsSteps: DNS_FALLBACK_STEPS,
  },
  {
    key: 'webflow', name: 'Webflow', icon: '🔷', defaultMethod: 'meta',
    metaSteps: ['Project Settings → Custom Code → Head Code', 'Paste the meta tag', 'Save changes and publish'],
    dnsSteps: DNS_FALLBACK_STEPS,
  },
  {
    key: 'framer', name: 'Framer', icon: '⬡', defaultMethod: 'meta',
    metaSteps: ['Site Settings → General → Custom Code → Head Start', 'Paste the meta tag', 'Publish your site'],
    dnsSteps: DNS_FALLBACK_STEPS,
  },
  {
    key: 'shopify', name: 'Shopify', icon: '🟢', defaultMethod: 'meta',
    metaSteps: ['Online Store → Themes → Edit code', 'Open theme.liquid', 'Paste the meta tag inside <head>', 'Save'],
    dnsSteps: DNS_FALLBACK_STEPS,
  },
  {
    key: 'wordpress', name: 'WordPress', icon: '🔵', defaultMethod: 'meta',
    metaSteps: ['Install a header/footer plugin (e.g. WPCode)', 'Add the meta tag to "Header"', 'Save and clear any cache'],
    dnsSteps: DNS_FALLBACK_STEPS,
  },
  {
    key: 'cloudflare', name: 'Cloudflare', icon: '🟠', defaultMethod: 'dns',
    dnsSteps: ['Open your domain in Cloudflare DNS', 'Add a TXT record — Name: @, Value: the token below', 'Save and wait 1–5 minutes for propagation'],
    metaSteps: META_FALLBACK_STEPS,
  },
  {
    key: 'vercel', name: 'Vercel', icon: '▲', defaultMethod: 'dns',
    dnsSteps: ['Project → Settings → Domains', 'Open your domain → DNS records', 'Add TXT record — Host: @, Value: the token below', 'Save'],
    metaSteps: META_FALLBACK_STEPS,
  },
  {
    key: 'other', name: '__OTHER__', icon: '❓', defaultMethod: 'dns',
    dnsSteps: ['Log into your DNS provider', 'Add a TXT record on the apex (@) with the token below', 'Wait 1–5 minutes and click "Verify"'],
    metaSteps: META_FALLBACK_STEPS,
  },
];

export function VerifyFlow({ domain, token, alreadyVerified = false }: Props) {
  const t = useTranslations('verify');
  const toast = useToast();
  const [path, setPath] = useState<Path>('tech');
  const [method, setMethod] = useState<Method>('dns');
  const [platformKey, setPlatformKey] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<null | 'ok' | 'fail'>(alreadyVerified ? 'ok' : null);

  const metaTag = `<meta name="vibesafe-verify" content="${token.replace('vibesafe-verify=', '')}" />`;
  const platform = PLATFORMS.find((p) => p.key === platformKey);
  const platformName = (p: { key: string; name: string }) => (p.key === 'other' ? t('platformOther') : p.name);

  const selectPlatform = (key: string) => {
    const p = PLATFORMS.find((pl) => pl.key === key);
    setPlatformKey(key);
    setMethod(p?.defaultMethod ?? 'dns');
  };

  const handleVerify = async () => {
    setVerifying(true);
    setResult(null);
    try {
      const response = await fetch('/api/v1/verify/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, method: METHOD_TO_API[method] }),
      });

      if (response.status === 429) {
        setResult('fail');
        const retryAfter = response.headers.get('Retry-After');
        const seconds = retryAfter ? parseInt(retryAfter, 10) : null;
        toast.warning(
          seconds && Number.isFinite(seconds)
            ? t('tooManyChecksRetry', { seconds, plural: seconds === 1 ? '' : 's' })
            : t('tooManyChecks'),
        );
        return;
      }

      const data = (await response.json().catch(() => ({}))) as {
        verified?: boolean;
        reason?: string;
        error?: string;
      };

      if (!response.ok) {
        setResult('fail');
        toast.error(data.error ?? t('checkFailed'));
        return;
      }

      if (data.verified) {
        setResult('ok');
      } else {
        setResult('fail');
        toast.error(data.reason ?? t('verifyFailFallback'));
      }
    } catch (err) {
      setResult('fail');
      toast.error(err instanceof Error ? err.message : t('networkError'));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
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
            {t('whyTitle')}
          </strong>
          <p
            style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}
            dangerouslySetInnerHTML={{ __html: t.raw('whyBody') as string }}
          />
        </div>
      </aside>

      <div
        role="tablist"
        aria-label={t('pathTabsLabel')}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-3)',
          maxWidth: 640,
          margin: '0 auto var(--space-8)',
        }}
      >
        <PathBtn active={path === 'tech'}   onClick={() => setPath('tech')}   emoji="👨‍💻" title={t('pathTechTitle')}   desc={t('pathTechDesc')} />
        <PathBtn active={path === 'guided'} onClick={() => setPath('guided')} emoji="🌐" title={t('pathGuidedTitle')} desc={t('pathGuidedDesc')} />
      </div>

      {path === 'tech' ? (
        <section
          aria-label={t('techMethodsLabel')}
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
            recommendedLabel={t('recommendedBadge')}
            active={method === 'dns'}
            onClick={() => setMethod('dns')}
            title={t('dnsTitle')}
            sub={t('dnsSub')}
          >
            <ol style={olCss}>
              <li>{t('dnsStep1')}</li>
              <li>{t('dnsStep2')}</li>
            </ol>
            <RecordBox
              lines={[
                [t('recordType'), 'TXT'],
                [t('recordName'), '@'],
                [t('recordValue'), token],
              ]}
              copyLabel={t('copy')}
              copyAria={(field) => t('copyAria', { field })}
            />
            <p style={hintCss}>{t('dnsHint')}</p>
            <ol start={3} style={olCss}>
              <li>{t('dnsStep3')}</li>
              <li>{t('dnsStep4')}</li>
            </ol>
          </MethodCard>

          <MethodCard
            active={method === 'meta'}
            onClick={() => setMethod('meta')}
            title={t('metaTagTitle')}
            sub={t('metaTagSub')}
          >
            <ol style={olCss}>
              <li>
                {t('metaStep1Prefix')} <code style={codeInlineCss}>&lt;head&gt;</code> {t('metaStep1Suffix')}
              </li>
            </ol>
            <CodeBlock code={metaTag} copyLabel={t('copy')} copyAria={t('copyCodeAria')} />
            <ol start={2} style={olCss}>
              <li>{t('metaStep2')}</li>
              <li>{t('metaStep3')}</li>
            </ol>
          </MethodCard>
        </section>
      ) : (
        <section aria-label={t('pathGuidedTitle')} style={{ maxWidth: 900, margin: '0 auto' }}>
          {platform == null ? (
            <>
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
                {t('guidedHelp')}
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
                      onClick={() => selectPlatform(p.key)}
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
                      <strong>{platformName(p)}</strong>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                        {p.key === 'other' ? t('platformOtherDescription') : (p.defaultMethod === 'dns' ? 'DNS · meta tag' : 'meta tag · DNS')}
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
                  {t('devViewLink')}
                </button>
              </p>
            </>
          ) : (
            <article className="card">
              <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setPlatformKey(null)}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', minHeight: 0 }}
                >
                  {t('otherPlatformLink')}
                </button>
                <span aria-hidden="true" style={{ fontSize: 28 }}>{platform.icon}</span>
                <h2 className="text-h3" style={{ margin: 0 }}>{platformName(platform)}</h2>
                {platform.defaultMethod === method && (
                  <span className="pill pill-accent" style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)' }}>
                    {t('recommendedFor', { platform: platformName(platform) })}
                  </span>
                )}
              </header>

              <div
                role="tablist"
                aria-label={t('methodTabsLabel')}
                style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}
              >
                {(['dns', 'meta'] as Method[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={method === m}
                    onClick={() => setMethod(m)}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid',
                      borderColor: method === m ? 'var(--accent)' : 'var(--border)',
                      background: method === m ? 'var(--accent-light)' : 'var(--surface-secondary)',
                      color: method === m ? 'var(--accent)' : 'var(--text-secondary)',
                      fontSize: 'var(--fs-sm)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    {m === 'dns' ? t('tabDnsLabel') : t('tabMetaLabel')}
                    {platform.defaultMethod === m && (
                      <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.75 }}>{t('methodRecommendedMarker')}</span>
                    )}
                  </button>
                ))}
              </div>

              <ol style={{ ...olCss, paddingLeft: 20 }}>
                {(method === 'dns' ? platform.dnsSteps : platform.metaSteps).map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <div style={{ marginTop: 'var(--space-5)' }}>
                {method === 'dns'
                  ? <RecordBox
                      lines={[
                        [t('recordType'), 'TXT'],
                        [t('recordName'), '@'],
                        [t('recordValue'), token],
                      ]}
                      copyLabel={t('copy')}
                      copyAria={(field) => t('copyAria', { field })}
                    />
                  : <CodeBlock code={metaTag} copyLabel={t('copy')} copyAria={t('copyCodeAria')} />}
              </div>
            </article>
          )}
        </section>
      )}

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
        <button data-testid="verify-submit" type="button" className="btn-primary" onClick={handleVerify} disabled={verifying}>
          {verifying
            ? t('verifying')
            : method === 'dns'
              ? t('verifyDnsBtn', { domain })
              : t('verifyMetaBtn', { domain })}
        </button>
        {result === 'ok' && (
          <p data-testid="verify-success" role="status" style={{ color: 'var(--success)', fontWeight: 600 }}>
            {t('verifiedOk')}{' '}
            <Link href="/active-test" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{t('verifiedContinue')}</Link>
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
          {[t('trustOneTime'), t('trustRemove'), t('trustRecheck'), t('trustNoTracking')].map((badge) => (
            <li key={badge} style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
              ✓ {badge}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

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
  recommendedLabel,
  active,
  onClick,
  title,
  sub,
  children,
}: {
  recommended?: boolean;
  recommendedLabel?: string;
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
      {recommended && recommendedLabel && (
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
          {recommendedLabel}
        </div>
      )}
      <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, marginBottom: 4 }}>{title}</h2>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }}>{sub}</p>
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </article>
  );
}

function RecordBox({
  lines,
  copyLabel,
  copyAria,
}: {
  lines: Array<[string, string]>;
  copyLabel: string;
  copyAria: (field: string) => string;
}) {
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
        <ContentsRow key={k} k={k} v={v} copyLabel={copyLabel} copyAria={copyAria(k)} />
      ))}
    </div>
  );
}

function ContentsRow({
  k,
  v,
  copyLabel,
  copyAria,
}: {
  k: string;
  v: string;
  copyLabel: string;
  copyAria: string;
}) {
  const copy = () => navigator.clipboard?.writeText(v).catch(() => {});
  return (
    <>
      <span style={{ color: 'var(--text-tertiary)' }}>{k}</span>
      <span style={{ color: 'var(--text)', wordBreak: 'break-all' }}>{v}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copyAria}
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
        {copyLabel}
      </button>
    </>
  );
}

function CodeBlock({ code, copyLabel, copyAria }: { code: string; copyLabel: string; copyAria: string }) {
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
        aria-label={copyAria}
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
        {copyLabel}
      </button>
    </div>
  );
}

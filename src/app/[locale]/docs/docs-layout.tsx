'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

const SECTION_KEYS = [
  { id: 'quick-start',     key: 'quickStart',     icon: '🚀' },
  { id: 'active-testing',  key: 'activeTesting',  icon: '⚔️' },
  { id: 'api-reference',   key: 'apiReference',   icon: '🔌' },
  { id: 'webhooks',        key: 'webhooks',       icon: '📡' },
  { id: 'ci-cd',           key: 'cicd',           icon: '🔁' },
  { id: 'fix-prompts',     key: 'fixPrompts',     icon: '🪄' },
  { id: 'faq',             key: 'faq',            icon: '❓' },
] as const;

export function DocsLayout() {
  const t = useTranslations('docs');
  const sections = SECTION_KEYS.map((s) => ({
    id: s.id,
    title: t(`sec.${s.key}`),
    icon: s.icon,
  }));
  const [active, setActive] = useState<string>(sections[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  return (
    <div className="container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>
      <header style={{ marginBottom: 'var(--space-10)', textAlign: 'center' }}>
        <div className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>{t('eyebrow')}</div>
        <h1 className="text-h2" style={{ marginBottom: 'var(--space-3)' }}>
          {t('heroTitle')}
        </h1>
        <p className="text-lead" style={{ maxWidth: 640, margin: '0 auto' }}>
          {t('heroLead')}
        </p>
      </header>

      <div className="docs-grid">
        <aside className="docs-sidebar" aria-label={t('sidebarAria')}>
          <nav>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {sections.map((s) => {
                const isActive = active === s.id;
                return (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      onClick={() => setActive(s.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 600,
                        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                        background: isActive ? 'var(--accent-light)' : 'transparent',
                        borderLeft: '3px solid',
                        borderLeftColor: isActive ? 'var(--accent)' : 'transparent',
                        textDecoration: 'none',
                        transition: 'background 0.15s, color 0.15s',
                      }}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <span aria-hidden="true">{s.icon}</span>
                      {s.title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <article className="docs-content">
          <DocSection id="quick-start" title={t('sec.quickStart')}>
            <p>{t('quickStart.p1')}</p>
            <ol>
              <li>{t('quickStart.step1')}</li>
              <li>{t('quickStart.step2')}</li>
              <li>{t('quickStart.step3')}</li>
              <li>{t('quickStart.step4')}</li>
            </ol>
            <Callout>
              <span dangerouslySetInnerHTML={{ __html: t.raw('quickStart.tip') as string }} />
            </Callout>
          </DocSection>

          <DocSection id="active-testing" title={t('sec.activeTesting')}>
            <p dangerouslySetInnerHTML={{ __html: t.raw('activeTesting.p1') as string }} />
            <h3>{t('activeTesting.prereqTitle')}</h3>
            <ul>
              <li>{t('activeTesting.prereq1')}</li>
              <li>{t('activeTesting.prereq2')}</li>
              <li>{t('activeTesting.prereq3')}</li>
            </ul>
            <h3>{t('activeTesting.durationTitle')}</h3>
            <p>{t('activeTesting.durationBody')}</p>
            <Code>
{`POST /api/v1/active-test
{
  "domain": "yoursite.com",
  "tests": ["sqli", "xss", "auth"],
  "scope": "owned-only"
}`}
            </Code>
          </DocSection>

          <DocSection id="api-reference" title={t('sec.apiReference')}>
            <p>{t('apiReference.p1')}</p>
            <h3>{t('apiReference.endpointsTitle')}</h3>
            <EndpointRow method="POST" path="/api/v1/scans" desc={t('apiReference.descStartPassive')} />
            <EndpointRow method="GET"  path="/api/v1/scans/:id" desc={t('apiReference.descGetScan')} />
            <EndpointRow method="GET"  path="/api/v1/scans/:id/findings" desc={t('apiReference.descListFindings')} />
            <EndpointRow method="POST" path="/api/v1/active-test" desc={t('apiReference.descStartActive')} />
            <EndpointRow method="GET"  path="/api/v1/active-test/:id/progress" desc={t('apiReference.descProgress')} />
            <EndpointRow method="POST" path="/api/v1/verify" desc={t('apiReference.descVerify')} />
            <Callout>
              <span dangerouslySetInnerHTML={{ __html: t.raw('apiReference.authNote') as string }} />
            </Callout>
          </DocSection>

          <DocSection id="webhooks" title={t('sec.webhooks')}>
            <p>{t('webhooks.p1')}</p>
            <h3>{t('webhooks.eventsTitle')}</h3>
            <ul>
              <li><code>scan.started</code> — {t('webhooks.evScanStarted')}</li>
              <li><code>scan.completed</code> — {t('webhooks.evScanCompleted')}</li>
              <li><code>scan.failed</code> — {t('webhooks.evScanFailed')}</li>
              <li><code>finding.critical</code> — {t('webhooks.evFindingCritical')}</li>
            </ul>
            <h3>{t('webhooks.payloadTitle')}</h3>
            <Code>
{`{
  "event": "scan.completed",
  "scan_id": "scn_8f3c…",
  "url": "https://yoursite.com",
  "grade": "B",
  "critical": 0,
  "high": 2,
  "report_url": "https://vibesafe.app/report/scn_8f3c…",
  "signature": "v1,t=1731,…"
}`}
            </Code>
          </DocSection>

          <DocSection id="ci-cd" title={t('sec.cicd')}>
            <p>{t('cicd.p1')}</p>
            <h3>{t('cicd.ghTitle')}</h3>
            <Code>
{`# .github/workflows/security.yml
- uses: vibesafe/scan-action@v1
  with:
    url: \${{ vars.PREVIEW_URL }}
    token: \${{ secrets.VIBESAFE_TOKEN }}
    fail-on: critical`}
            </Code>
            <h3>{t('cicd.glTitle')}</h3>
            <Code>{`npx @vibesafe/cli scan --url $PREVIEW_URL --fail-on critical`}</Code>
          </DocSection>

          <DocSection id="fix-prompts" title={t('sec.fixPrompts')}>
            <p>{t('fixPrompts.p1')}</p>
            <h3>{t('fixPrompts.supportedTitle')}</h3>
            <ul>
              <li dangerouslySetInnerHTML={{ __html: t.raw('fixPrompts.sCursor') as string }} />
              <li dangerouslySetInnerHTML={{ __html: t.raw('fixPrompts.sLovable') as string }} />
              <li dangerouslySetInnerHTML={{ __html: t.raw('fixPrompts.sBolt') as string }} />
              <li dangerouslySetInnerHTML={{ __html: t.raw('fixPrompts.sV0') as string }} />
              <li dangerouslySetInnerHTML={{ __html: t.raw('fixPrompts.sReplit') as string }} />
            </ul>
            <Callout>
              <span dangerouslySetInnerHTML={{ __html: t.raw('fixPrompts.note') as string }} />
            </Callout>
          </DocSection>

          <DocSection id="faq" title={t('sec.faq')}>
            <h3>{t('faq.q1')}</h3>
            <p>{t('faq.a1')}</p>
            <h3>{t('faq.q2')}</h3>
            <p dangerouslySetInnerHTML={{ __html: t.raw('faq.a2') as string }} />
            <h3>{t('faq.q3')}</h3>
            <p>{t('faq.a3')}</p>
            <h3>{t('faq.q4')}</h3>
            <p>{t('faq.a4')}</p>
          </DocSection>
        </article>
      </div>
    </div>
  );
}

function DocSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 'calc(var(--nav-h) + 24px)', marginBottom: 'var(--space-16)' }}>
      <h2 className="text-h3" style={{ marginBottom: 'var(--space-5)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-3)' }}>
        {title}
      </h2>
      <div className="docs-prose">{children}</div>
    </section>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <aside style={{
      margin: 'var(--space-5) 0',
      padding: 'var(--space-4) var(--space-5)',
      borderLeft: '3px solid var(--accent)',
      background: 'var(--accent-light)',
      borderRadius: '0 var(--radius-md) var(--radius-md) 0',
      fontSize: 'var(--fs-sm)',
      color: 'var(--text-secondary)',
      lineHeight: 1.6,
    }}>
      {children}
    </aside>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre style={{
      background: 'var(--surface-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)',
      overflow: 'auto',
      fontFamily: 'var(--mono)',
      fontSize: 'var(--fs-sm)',
      lineHeight: 1.6,
      color: 'var(--text)',
      margin: 'var(--space-4) 0',
    }}>
      <code>{children}</code>
    </pre>
  );
}

function EndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const tone =
    method === 'POST' ? '#0D9488' :
    method === 'GET'  ? '#2563EB' :
    method === 'DELETE' ? '#DC2626' : '#71717A';
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '70px minmax(0, 1.4fr) minmax(0, 1fr)',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-3) 0',
      borderBottom: '1px solid var(--border)',
      fontSize: 'var(--fs-sm)',
    }}>
      <span style={{
        fontFamily: 'var(--mono)', fontWeight: 700,
        fontSize: 11, color: tone,
        padding: '2px 8px', borderRadius: 4,
        background: `${tone}1A`,
        textAlign: 'center',
        letterSpacing: '0.04em',
      }}>{method}</span>
      <code style={{ fontFamily: 'var(--mono)', color: 'var(--text)', wordBreak: 'break-all' }}>{path}</code>
      <span style={{ color: 'var(--text-tertiary)' }}>{desc}</span>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

interface DocSection {
  id: string;
  title: string;
  icon: string;
}

const SECTIONS: DocSection[] = [
  { id: 'quick-start',     title: 'Quick start',         icon: '🚀' },
  { id: 'active-testing',  title: 'Active testing',      icon: '⚔️' },
  { id: 'api-reference',   title: 'API reference',       icon: '🔌' },
  { id: 'webhooks',        title: 'Webhooks',            icon: '📡' },
  { id: 'ci-cd',           title: 'CI/CD integration',   icon: '🔁' },
  { id: 'fix-prompts',     title: 'Fix prompts',         icon: '🪄' },
  { id: 'faq',             title: 'FAQ',                 icon: '❓' },
];

export function DocsLayout() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  // Scroll-spy: highlight the section currently in view
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
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>
      <header style={{ marginBottom: 'var(--space-10)', textAlign: 'center' }}>
        <div className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>📚 Documentation</div>
        <h1 className="text-h2" style={{ marginBottom: 'var(--space-3)' }}>
          Everything you need to ship secure
        </h1>
        <p className="text-lead" style={{ maxWidth: 640, margin: '0 auto' }}>
          Get started in 60 seconds, integrate with your CI, or dig into the API.
        </p>
      </header>

      <div className="docs-grid">
        {/* Sidebar */}
        <aside className="docs-sidebar" aria-label="Documentation navigation">
          <nav>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {SECTIONS.map((s) => {
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

        {/* Content */}
        <article className="docs-content">
          <DocSection id="quick-start" title="Quick start">
            <p>
              VibeSafe runs a full passive scan in 90 seconds. No signup is required to test a site
              — paste a URL and you&apos;re scanning.
            </p>
            <ol>
              <li>Go to the homepage and paste your URL into the scan bar.</li>
              <li>Wait ~90 seconds while we run 15 security modules.</li>
              <li>Review the findings — each ships with a paste-ready AI fix prompt.</li>
              <li>Paste the prompt into Cursor, Lovable, Bolt, v0, or Replit and ship the fix.</li>
            </ol>
            <Callout>
              <strong>Tip:</strong> Free scans surface the top 5 critical findings. Upgrade to see
              every finding and unlock active testing.
            </Callout>
          </DocSection>

          <DocSection id="active-testing" title="Active testing">
            <p>
              Active testing sends real attack probes (SQLi, XSS, auth bypass, API fuzzing) against
              a domain you own. Findings are <strong>CONFIRMED exploitable</strong>, never speculative.
            </p>
            <h3>Prerequisites</h3>
            <ul>
              <li>Verify ownership of the target domain (DNS TXT record or HTML meta tag).</li>
              <li>3 credits per active test (~$3.48). Replaces a $5,000 manual pentest.</li>
              <li>Probes are rate-limited and run from a fixed IP block so you can allowlist them.</li>
            </ul>
            <h3>How long does it take?</h3>
            <p>~8 minutes on average for a 5-page site. Larger surfaces scale linearly.</p>
            <Code>
{`POST /api/v1/active-test
{
  "domain": "yoursite.com",
  "tests": ["sqli", "xss", "auth"],
  "scope": "owned-only"
}`}
            </Code>
          </DocSection>

          <DocSection id="api-reference" title="API reference">
            <p>
              Every dashboard action is available over the REST API. Authenticate with a bearer token
              from your dashboard.
            </p>
            <h3>Endpoints</h3>
            <EndpointRow method="POST" path="/api/v1/scans" desc="Start a passive scan" />
            <EndpointRow method="GET"  path="/api/v1/scans/:id" desc="Get scan status & findings" />
            <EndpointRow method="GET"  path="/api/v1/scans/:id/findings" desc="Paginated findings list" />
            <EndpointRow method="POST" path="/api/v1/active-test" desc="Start an active DAST scan" />
            <EndpointRow method="GET"  path="/api/v1/active-test/:id/progress" desc="SSE stream of progress" />
            <EndpointRow method="POST" path="/api/v1/verify" desc="Verify a DNS TXT or meta tag" />
            <Callout>
              <strong>Auth:</strong> <code>Authorization: Bearer vs_live_…</code>
            </Callout>
          </DocSection>

          <DocSection id="webhooks" title="Webhooks">
            <p>
              Subscribe to scan lifecycle events. We retry failed deliveries with exponential backoff
              up to 8 times.
            </p>
            <h3>Event types</h3>
            <ul>
              <li><code>scan.started</code> — fired when a scan begins</li>
              <li><code>scan.completed</code> — fired when a scan finishes</li>
              <li><code>scan.failed</code> — fired if the scan errors</li>
              <li><code>finding.critical</code> — fired the moment a critical finding is detected</li>
            </ul>
            <h3>Payload</h3>
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

          <DocSection id="ci-cd" title="CI/CD integration">
            <p>
              Block merges on regressions. The VibeSafe CLI exits non-zero if your grade drops or new
              critical findings appear vs. the last main-branch scan.
            </p>
            <h3>GitHub Actions</h3>
            <Code>
{`# .github/workflows/security.yml
- uses: vibesafe/scan-action@v1
  with:
    url: \${{ vars.PREVIEW_URL }}
    token: \${{ secrets.VIBESAFE_TOKEN }}
    fail-on: critical`}
            </Code>
            <h3>GitLab / CircleCI / others</h3>
            <Code>{`npx @vibesafe/cli scan --url $PREVIEW_URL --fail-on critical`}</Code>
          </DocSection>

          <DocSection id="fix-prompts" title="Fix prompts">
            <p>
              Every finding ships with a paste-ready prompt tuned for your AI assistant. Prompts are
              versioned and include the surrounding code context.
            </p>
            <h3>Supported assistants</h3>
            <ul>
              <li><strong>Cursor</strong> — drops into <kbd>⌘K</kbd> with the file already open</li>
              <li><strong>Lovable</strong> — pasted into the chat panel</li>
              <li><strong>Bolt.new</strong> — pasted into the project chat</li>
              <li><strong>v0</strong> — pasted into a new generation</li>
              <li><strong>Replit Agent</strong> — pasted into the Agent chat</li>
            </ul>
            <Callout>
              <strong>Note:</strong> Prompts include framework hints (Next.js, Vite, Rails, etc.) so
              the assistant generates idiomatic fixes.
            </Callout>
          </DocSection>

          <DocSection id="faq" title="FAQ">
            <h3>Do you store the scanned site&apos;s content?</h3>
            <p>
              We store findings, a screenshot, and request/response samples for findings — never the
              full site. All data is encrypted at rest (AES-256) and deleted after 90 days on free,
              365 days on paid.
            </p>
            <h3>Is this legal for sites I don&apos;t own?</h3>
            <p>
              <strong>Passive scans</strong> are legal anywhere — they only access publicly available
              data. <strong>Active scans</strong> require domain ownership verification (CFAA compliance).
            </p>
            <h3>Can I self-host?</h3>
            <p>Self-host is on the Enterprise tier — contact sales for details.</p>
            <h3>What about false positives?</h3>
            <p>
              Every active-test finding is CONFIRMED exploitable (we capture a proof-of-exploit
              payload). Passive findings have a confidence score; high-confidence findings have a
              false-positive rate below 0.5%.
            </p>
          </DocSection>
        </article>
      </div>
    </div>
  );
}

/* ──── primitives ──── */

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
